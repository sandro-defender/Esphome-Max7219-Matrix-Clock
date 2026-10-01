import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync, readdirSync } from "node:fs";

import App from "./App";
import { FONT_CATALOG, PREVIEW_CANDIDATES } from "./fontCatalog";

/**
 * Smoke + structure test: the whole app must render without a DOM, the
 * project-page sections must all exist, and the presentation contract
 * (pinned mobile preview, gallery, documentation links) must hold.
 */
describe("App", () => {
  const markup = renderToStaticMarkup(<App />);

  it("renders the configurator shell", () => {
    expect(markup).toContain("Clock<span>lab</span>");
    expect(markup).toContain("MAX7219");
    expect(markup).toContain("Copy install YAML");
  });

  it("offers every catalogued firmware face in the picker", () => {
    for (const spec of FONT_CATALOG) {
      expect(markup, spec.label).toContain(spec.label);
    }
  });

  it("uses Configure and Info & help pages while rendering every section", () => {
    expect(markup).toContain('aria-label="Configurator pages"');
    expect(markup).toContain(">Configure</button>");
    expect(markup).toContain(">Info &amp; help</button>");
    for (const id of ["preview", "tune", "font-lab", "hardware", "install", "assistant", "troubleshooting", "gallery", "docs"]) {
      expect(markup, id).toContain(`id="${id}"`);
    }
    expect(markup).toContain('class="content-col info-page" hidden=""');
  });

  it("keeps exactly one h1 and labels every section", () => {
    expect(markup.match(/<h1/g)).toHaveLength(1);
    for (const id of ["preview", "tune", "font-lab", "hardware", "install", "assistant", "troubleshooting", "gallery", "docs"]) {
      expect(markup, id).toContain(`aria-labelledby="${id}-title"`);
    }
  });

  it("groups Tune and Troubleshooting in native disclosures with essential groups expanded", () => {
    for (const name of ["Clock face", "Screen", "Messages", "Light", "Hardware", "Device"]) {
      expect(markup).toContain(`<summary>${name}</summary>`);
    }
    for (const name of ["Clock face", "Hardware", "Device"]) {
      expect(markup).toMatch(new RegExp(`<details[^>]* open=""><summary>${name}</summary>`));
    }
    expect(markup).toMatch(/<details[^>]*><summary>Messages<\/summary>/);
    for (const term of ["Blank display", "Mirrored or swapped modules", "Wrong time", "Font too wide", "OTA updates"]) {
      expect(markup, term).toContain(`<summary>${term}</summary>`);
    }
  });

  it("explains the preview layout choice and the module guides", () => {
    expect(markup).toContain("Preview layout");
    expect(markup).toContain("the same fallback rules");
    expect(markup).toContain("Module boundary guides");
  });

  it("shows the selected face, pixel size and fallback state in the status strip", () => {
    expect(markup).toContain('aria-label="Preview status"');
    expect(markup).toContain("HH:MM:SS");
    expect(markup).toContain("<span>Fallback</span>");
  });

  it("renders the live matrix canvas inside the chassis with a pinning spacer", () => {
    expect(markup).toMatch(/<section id="preview"[^>]*>/);
    expect(markup).toContain('class="chassis-slot"');
    expect(markup).toContain('class="chassis"');
    expect(markup.match(/role="img"/g)!.length).toBeGreaterThan(0);
  });

  it("documents the default wiring values in the hardware section", () => {
    expect(markup).toContain("Default wiring");
    expect(markup).toContain("Common ground with the matrix is mandatory");
    expect(markup).toContain("Module grid test");
    expect(markup).toContain("Pixel checkerboard");
  });

  it("explains installation beside secrets.yaml and lists the six secret keys", () => {
    expect(markup).toContain("beside your existing <code>secrets.yaml</code>");
    for (const key of ["wifi_ssid", "wifi_password", "api_encryption_key", "fallback_ap_password", "web_server_username", "web_server_password"]) {
      expect(markup, key).toContain(key);
    }
    expect(markup).toContain("esphome config max7219-clock.yaml");
    expect(markup).toContain("encrypted native OTA");
  });

  it("links README, VALIDATION, ROADMAP and GitHub issues", () => {
    for (const url of [
      "https://github.com/sandro-defender/Esphome-Max7219-Matrix-Clock/blob/main/README.md",
      "https://github.com/sandro-defender/Esphome-Max7219-Matrix-Clock/blob/main/VALIDATION.md",
      "https://github.com/sandro-defender/Esphome-Max7219-Matrix-Clock/blob/main/ROADMAP.md",
      "https://github.com/sandro-defender/Esphome-Max7219-Matrix-Clock/issues",
    ]) {
      expect(markup, url).toContain(url);
    }
  });

  it("shows a gallery figure for every shipped hardware photo with alt text and caption", () => {
    const imageDir = new URL("../public/images", import.meta.url);
    const files = readdirSync(imageDir).filter((name) => name.endsWith(".jpg")).sort();
    expect(files.length).toBeGreaterThanOrEqual(6);

    const figures = [
      ...markup.matchAll(/<figure[^>]*>\s*<img src="\.\/images\/([\w.-]+)" alt="([^"]+)"[^>]*\/?>\s*<figcaption>([^<]+)<\/figcaption>/g),
    ];
    const referenced = figures.map((match) => match[1]).sort();
    expect(referenced).toEqual(files);

    for (const [, file, alt, caption] of figures) {
      expect(alt.length, `${file} alt`).toBeGreaterThanOrEqual(40);
      expect(caption.length, `${file} caption`).toBeGreaterThanOrEqual(20);
    }
    // The required shots are all present.
    for (const part of ["clock-in-use.jpg", "wired-matrix-back.jpg", "wired-matrix-end.jpg", "workbench.jpg"]) {
      expect(referenced, part).toContain(part);
    }
  });

  it("never asks for credentials anywhere in the page", () => {
    expect(markup).not.toContain('type="password"');
    expect(markup).toContain("never asks for");
  });

  it("separates firmware fonts from the preview-only Font Lab", () => {
    expect(markup).toContain("Fonts included in firmware");
    expect(markup).toContain("Preview-only Font Lab");
    expect(markup).toContain("preview only");
    for (const candidate of PREVIEW_CANDIDATES) {
      expect(markup, candidate.label).toContain(candidate.label);
    }
  });
});

/* ------------------------------------------------------------------ *
 * Layout contract
 *
 * Parsed out of index.css and the rendered markup instead of eyeballed, so a
 * spacing or stacking regression fails here rather than on a phone.
 * ------------------------------------------------------------------ */

const DESKTOP = "@media (min-width: 980px)";
const PHONE = "@media (max-width: 979px)";

/** Bodies of every `{…}` block that follows `opener`, braces balanced. */
function blocks(scope: string, opener: string): string[] {
  const found: string[] = [];
  let from = 0;
  for (;;) {
    const start = scope.indexOf(opener, from);
    if (start < 0) break;
    let depth = 0;
    let index = scope.indexOf("{", start);
    const body = index + 1;
    for (; index < scope.length; index++) {
      if (scope[index] === "{") depth += 1;
      else if (scope[index] === "}") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    found.push(scope.slice(body, index));
    from = index + 1;
  }
  return found;
}

/** Declarations of a selector, optionally inside every block of a media query. */
function rule(css: string, selector: string, media?: string): string {
  const scopes = media ? blocks(css, media) : [css];
  expect(scopes.length, `missing ${media ?? "css"}`).toBeGreaterThan(0);
  const matches = scopes.flatMap((scope) => blocks(scope, `${selector} {`));
  expect(matches.length, `missing ${selector}${media ? ` in ${media}` : ""}`).toBeGreaterThan(0);
  return matches.join("\n");
}

describe("responsive layout", () => {
  const markup = renderToStaticMarkup(<App />);
  const css = readFileSync(new URL("./index.css", import.meta.url), "utf8");

  it("opens the preview column with the matrix, then the time and the face", () => {
    const stage = markup.indexOf('<section id="preview"');
    const chassis = markup.indexOf('class="chassis"', stage);
    const readout = markup.indexOf('class="readout"', stage);
    const status = markup.indexOf('aria-label="Preview status"', stage);

    expect(stage).toBeGreaterThan(-1);
    expect(chassis).toBeGreaterThan(stage);
    expect(chassis).toBeLessThan(readout);
    expect(readout).toBeLessThan(status);
    // The page title sits in the settings column: no block of text is stacked
    // above the panel, so the first desktop screen is the matrix itself.
    expect(markup.indexOf("<h1")).toBeGreaterThan(status);
  });

  it("keeps the essential preview controls above the fold beside the matrix", () => {
    const controls = markup.indexOf('id="preview-time"');
    const composer = markup.indexOf('id="ha-message"');
    const tune = markup.indexOf('<section id="tune"');

    expect(controls).toBeGreaterThan(0);
    expect(composer).toBeGreaterThan(0);
    expect(controls).toBeLessThan(tune);
    expect(composer).toBeLessThan(tune);
    // They live in the settings column, not under the sticky device rail.
    expect(markup.indexOf('class="content-col"')).toBeLessThan(controls);
  });

  it("wastes no vertical space above the desktop matrix", () => {
    const shell = rule(css, ".shell", DESKTOP);
    expect(shell).toContain("display: grid");
    expect(shell).toContain("align-items: start");
    expect(Number(/padding: (\d+)px/.exec(shell)![1])).toBeLessThanOrEqual(16);
    expect(rule(css, ".chassis")).toContain("margin-top: 0");
    expect(rule(css, ".chassis-slot")).toContain("height: 0");
    expect(rule(css, ".topbar")).toContain("padding: 12px 16px 8px");
  });

  it("keeps the desktop preview a sticky rail beside every section", () => {
    expect(rule(css, ".stage-col", DESKTOP)).toContain("align-self: stretch");
    const stage = rule(css, ".stage", DESKTOP);
    expect(stage).toContain("position: sticky");
    expect(stage).toContain("top: calc(var(--nav-h) + 14px)");
  });

  it("pins the phone matrix under the measured chrome and under the menu", () => {
    const chassis = rule(css, ".chassis", PHONE);
    expect(chassis).toContain("position: fixed");
    expect(chassis).toContain("top: calc(var(--pin-top) + var(--pin-gap))");
    expect(chassis).toContain("z-index: 40");
    expect(chassis).toContain("env(safe-area-inset-left");
    // Centred and capped instead of stretched across a landscape tablet.
    expect(chassis).toContain("left: 50%");
    expect(chassis).toContain("max-width: 640px");

    const nav = rule(css, ".site-nav");
    expect(nav).toContain("position: sticky");
    expect(nav).toContain("top: 0");
    expect(nav).toContain("env(safe-area-inset-top");
    // Stacking and opacity: the menu paints over the matrix, never through it.
    expect(Number(/z-index: (\d+)/.exec(nav)![1])).toBeGreaterThan(40);
    expect(Number(/rgba\(16, 14, 12, ([\d.]+)\)/.exec(nav)![1])).toBeGreaterThanOrEqual(0.95);

    // The spacer keeps the document height honest while the chassis is fixed.
    expect(rule(css, ".chassis-slot", PHONE)).toContain("height: 200px");
    expect(markup).toContain('class="chassis-slot"');
  });

  it("gives anchor jumps room for the menu and the pinned matrix", () => {
    expect(rule(css, "html")).toContain("scroll-padding-top: calc(var(--nav-h) + 12px)");
    expect(rule(css, ".doc-section, .stage", PHONE)).toContain("var(--chassis-h)");
  });

  it("keeps the panel centred and inside its column", () => {
    const wrap = rule(css, ".matrix-wrap");
    expect(wrap).toContain("justify-content: center");
    expect(wrap).toContain("min-width: 0");
  });

  it("surfaces the per-digit slide and a way to see it", () => {
    expect(markup).toContain("Digit slide-up");
    expect(markup).toContain("600 ms");
    expect(markup).toContain("Replay last change");
    expect(markup).toContain("Tune → Screen");
  });
});
