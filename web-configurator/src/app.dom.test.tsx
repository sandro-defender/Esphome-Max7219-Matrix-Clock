// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import App from "./App";
import { PREVIEW_CANDIDATES } from "./fontCatalog";

/**
 * Mounts the real configurator in a DOM.
 *
 * jsdom has no layout engine and no 2D canvas, so this cannot measure pixels —
 * it verifies the parts that only exist once effects run: the pinned-chrome
 * measurement that keeps the matrix clear of the menu, the slide state machine
 * behind the "Replay" control, and the font checkbox reaching the live preview.
 */

const observers: Array<() => void> = [];

class MockResizeObserver {
  constructor(callback: () => void) {
    observers.push(callback);
  }
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

function rect(height: number, bottom: number): DOMRect {
  return {
    x: 0,
    y: bottom - height,
    width: 375,
    height,
    top: bottom - height,
    right: 375,
    bottom,
    left: 0,
    toJSON: () => ({}),
  } as DOMRect;
}

/** Text of the status strip cell with this label. */
function statusValue(container: HTMLElement, label: string): string {
  const cell = [...container.querySelectorAll(".status-strip li")].find((item) =>
    item.querySelector("span")?.textContent?.includes(label),
  );
  return cell?.querySelector("b")?.textContent ?? "";
}

/** React tracks input values, so a test has to go through the native setter. */
function setNativeValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function slideStatus(container: HTMLElement): string {
  return container.querySelector(".slide-panel b")?.textContent ?? "";
}

let root: Root | null = null;
let container: HTMLElement;

async function mount(): Promise<HTMLElement> {
  container = document.createElement("div");
  document.body.appendChild(container);
  await act(async () => {
    root = createRoot(container);
    root.render(<App />);
  });
  return container;
}

beforeEach(() => {
  // One fixed "now" for every test, with the rAF/interval clock under control.
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 0, 2, 12, 34, 56));
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  observers.length = 0;
  vi.stubGlobal("ResizeObserver", MockResizeObserver);
  // jsdom reports 0 for every box; give the chrome and the chassis real sizes.
  Object.defineProperty(window.HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get() {
      return this.classList.contains("chassis") ? 132 : 0;
    },
  });
  Object.defineProperty(window.HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get() {
      return this.classList.contains("matrix-wrap") ? 636 : 375;
    },
  });
  window.Element.prototype.getBoundingClientRect = function () {
    // Brand row 80 px, section nav 44 px pinned under it at the top of the page.
    return this.classList.contains("site-nav") ? rect(44, 124) : rect(80, 80);
  };
  // jsdom has no 2D context; the preview has to cope without painting.
  window.HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  root = null;
  container?.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.localStorage.clear();
  document.documentElement.removeAttribute("style");
});

describe("mounted configurator", () => {
  it("mounts, measures the chrome and pins the matrix below it", async () => {
    const mounted = await mount();
    const style = document.documentElement.style;

    // The nav is 44 px tall and ends 124 px down while the brand row is visible:
    // the pinned matrix has to start below both, never under the menu.
    expect(style.getPropertyValue("--nav-h")).toBe("44px");
    expect(style.getPropertyValue("--pin-top")).toBe("124px");
    // …and the spacer reserves the measured chassis height in the flow.
    expect(style.getPropertyValue("--chassis-h")).toBe("132px");
    expect(mounted.querySelector(".chassis-slot")).toHaveProperty("style");
    expect((mounted.querySelector(".chassis-slot") as HTMLElement).style.height).toBe("132px");
  });

  it("keeps the matrix the first element of the preview column", async () => {
    const mounted = await mount();
    const stage = mounted.querySelector("#preview")!;
    expect(stage.firstElementChild?.className).toBe("chassis-slot");
    expect(stage.children[1].className).toBe("chassis");
    expect(stage.querySelector(".chassis canvas")).not.toBeNull();
    expect(stage.querySelector(".chassis canvas")?.getAttribute("role")).toBe("img");
  });

  it("runs the per-digit slide on demand and lets it settle", async () => {
    const mounted = await mount();

    expect(slideStatus(mounted)).toBe("600 ms");

    const replay = [...mounted.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Replay last change"),
    )!;
    await act(async () => {
      replay.click();
    });
    // The slide is in flight: the previous second's digits are on their way out.
    expect(slideStatus(mounted)).toContain("sliding");

    await act(async () => {
      vi.advanceTimersByTime(700);
    });
    expect(slideStatus(mounted)).toBe("600 ms");
  });

  it("follows the digit animation switch and the duration slider", async () => {
    const mounted = await mount();
    const replay = () =>
      [...mounted.querySelectorAll("button")].find((button) => button.textContent?.includes("Replay last change"))!;

    // Tune → Screen holds the switch; it is a native button with aria-pressed.
    const toggle = [...mounted.querySelectorAll("button.toggle-row")].find((button) =>
      button.textContent?.includes("Digit slide-up animation"),
    ) as HTMLButtonElement;
    expect(toggle.getAttribute("aria-pressed")).toBe("true");

    await act(async () => {
      toggle.click();
    });
    expect(slideStatus(mounted)).toBe("off");
    await act(async () => {
      replay().click();
    });
    expect(slideStatus(mounted)).toBe("off");

    await act(async () => {
      toggle.click();
    });
    expect(slideStatus(mounted)).toBe("600 ms");

    // The Animation duration slider drives the same readout.
    const slider = [...mounted.querySelectorAll("input[type=range]")].find(
      (input) => input.closest("label")?.textContent?.includes("Animation duration"),
    ) as HTMLInputElement;
    await act(async () => {
      setNativeValue(slider, "250");
    });
    expect(slideStatus(mounted)).toBe("250 ms");
    await act(async () => {
      replay().click();
    });
    expect(slideStatus(mounted)).toContain("sliding");
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(slideStatus(mounted)).toBe("250 ms");
  });

  it("stands still when the system asks for reduced motion", async () => {
    window.matchMedia = ((query: string) => ({
      matches: query.includes("reduced-motion"),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;

    const mounted = await mount();
    expect(slideStatus(mounted)).toBe("reduced motion");
    expect(mounted.textContent).toContain("Your system asks for reduced motion");

    const replay = [...mounted.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Replay last change"),
    )!;
    await act(async () => {
      replay.click();
      vi.advanceTimersByTime(1000);
    });
    // The digits update in one step; nothing slides.
    expect(slideStatus(mounted)).toBe("reduced motion");
  });

  it("selects a newly included font in the live preview and in the installer", async () => {
    const mounted = await mount();
    expect(statusValue(mounted, "Face")).toBe("Dot Matrix");

    const choice = [...mounted.querySelectorAll("label.font-choice")].find((label) =>
      label.textContent?.includes("Handjet"),
    )!;
    const checkbox = choice.querySelector("input[type=checkbox]") as HTMLInputElement;
    await act(async () => {
      checkbox.click();
    });

    expect(statusValue(mounted, "Face")).toBe("Handjet");
    expect(mounted.querySelector(".font-counter")?.textContent).toContain("1 / 3");
    const yaml = [...mounted.querySelectorAll("pre")].map((pre) => pre.textContent ?? "").join("\n");
    expect(yaml).toContain("packages/fonts/handjet.yaml");
  });

  it("offers the MD MAX72XX System face and installs its package", async () => {
    const mounted = await mount();
    const choice = [...mounted.querySelectorAll("label.font-choice")].find((label) =>
      label.textContent?.includes("MD MAX72XX System"),
    )!;
    expect(choice.textContent).toContain("adds a package and switches the preview to it");

    await act(async () => {
      (choice.querySelector("input[type=checkbox]") as HTMLInputElement).click();
    });

    // Checking a firmware face selects it in the live preview and in the YAML.
    expect(statusValue(mounted, "Face")).toBe("MD MAX72XX System");
    const card = [...mounted.querySelectorAll(".font-card")].find((entry) =>
      entry.textContent?.includes("MD MAX72XX System"),
    )!;
    // Measured from the rasterised firmware glyphs, not from a hard-coded number.
    expect(card.textContent).toContain("size 8 · HH:MM:SS 34px · digits 8px tall");
    expect(card.textContent).toContain("_sysfont");
    expect(mounted.textContent).toContain("font_md_max72xx_system_source");
    expect(mounted.textContent).toContain("LGPL-2.1-or-later");
    const yaml = [...mounted.querySelectorAll("pre")].map((pre) => pre.textContent ?? "").join("\n");
    expect(yaml).toContain("packages/fonts/md-max72xx-system.yaml");
    expect(yaml).toContain('initial_option: "MD MAX72XX System"');
  });

  it("never offers a preview-only face in the installer", async () => {
    const mounted = await mount();
    const yaml = [...mounted.querySelectorAll("pre")].map((pre) => pre.textContent ?? "").join("\n");
    for (const candidate of PREVIEW_CANDIDATES) {
      expect(yaml, candidate.label).not.toContain(candidate.id);
    }
    expect(mounted.textContent).toContain("Preview-only Font Lab");
  });

  it("renders the gallery photos and the documentation links", async () => {
    const mounted = await mount();
    const figures = [...mounted.querySelectorAll(".photo-grid figure")];
    expect(figures).toHaveLength(6);
    for (const figure of figures) {
      const img = figure.querySelector("img")!;
      expect(img.getAttribute("src")).toMatch(/^\.\/images\/[\w.-]+\.jpg$/);
      expect((img.getAttribute("alt") ?? "").length).toBeGreaterThanOrEqual(40);
      expect((figure.querySelector("figcaption")?.textContent ?? "").length).toBeGreaterThanOrEqual(20);
    }
    const links = [...mounted.querySelectorAll("a")].map((link) => link.getAttribute("href") ?? "");
    for (const href of [
      "https://github.com/sandro-defender/Esphome-Max7219-Matrix-Clock/blob/main/README.md",
      "https://github.com/sandro-defender/Esphome-Max7219-Matrix-Clock/blob/main/VALIDATION.md",
      "https://github.com/sandro-defender/Esphome-Max7219-Matrix-Clock/blob/main/ROADMAP.md",
      "https://github.com/sandro-defender/Esphome-Max7219-Matrix-Clock/issues",
    ]) {
      expect(links, href).toContain(href);
    }
  });

  it("asks for no credential anywhere", async () => {
    const mounted = await mount();
    expect(mounted.querySelector('input[type="password"]')).toBeNull();
    for (const input of [...mounted.querySelectorAll("input, select, textarea")]) {
      expect(input.getAttribute("type")).not.toBe("password");
    }
    expect(mounted.textContent).toContain("never asks for");
  });
});
