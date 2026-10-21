// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { LiveStage } from "./LiveStage";
import { naturalPanelWidth } from "./MatrixCanvas";
import { renderScene } from "./render";
import { DEFAULT_CONFIG, type Config } from "./types";

let root: Root | undefined;
let host: HTMLDivElement;

function mount(cfg: Config = DEFAULT_CONFIG) {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const now = new Date(2026, 9, 21, 11, 18, 20);
  act(() => root!.render(<LiveStage cfg={cfg} scene={renderScene(cfg, now, 0)} now={now} />));
}

function scrollTo(y: number) {
  act(() => {
    Object.defineProperty(window, "scrollY", { value: y, configurable: true });
    window.dispatchEvent(new Event("scroll"));
  });
}

afterEach(() => {
  if (root) act(() => root!.unmount());
  root = undefined;
  host?.remove();
  document.documentElement.style.removeProperty("--matrix-w");
});

describe("pinned live stage", () => {
  it("compacts to just the pixel table after scrolling and restores near the top", () => {
    mount();
    const chassis = host.querySelector(".chassis")!;
    expect(chassis).toBeTruthy();
    expect(chassis.className).not.toContain("compact");

    scrollTo(120);
    expect(chassis.className).toContain("compact");

    // Hysteresis: mid-page scrolling must not flap the state back and forth.
    scrollTo(40);
    expect(chassis.className).toContain("compact");

    scrollTo(10);
    expect(chassis.className).not.toContain("compact");
  });

  it("publishes the unshrunk panel width so a wide chassis can stretch to the edges", () => {
    // Chassis padding + slack is what the CSS var adds on top of the lattice.
    const expected = (modules: number, value: string) => {
      const wide: Config = { ...DEFAULT_CONFIG, chips: modules, rows: 1 };
      mount(wide);
      expect(document.documentElement.style.getPropertyValue("--matrix-w")).toBe(value);
    };
    expected(12, `${naturalPanelWidth(12, 1) + 26}px`);
    expected(6, `${naturalPanelWidth(6, 1) + 26}px`);
  });
});
