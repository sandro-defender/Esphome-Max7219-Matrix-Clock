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
  const css = readFileSync(new URL("./index.css", import.meta.url), "utf8");

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

  it("lists every project section in the anchor nav and renders them", () => {
    const sections = ["preview", "tune", "font-lab", "hardware", "install", "assistant", "troubleshooting", "gallery", "docs"];
    for (const id of sections) {
      expect(markup, id).toContain(`id="${id}"`);
      expect(markup, id).toContain(`href="#${id}"`);
    }
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

  it("pins the chassis on phones with a fixed rule and reserves its space", () => {
    const pinAt = css.indexOf("@media (max-width: 979px) {\n  .stage { display: flex");
    expect(pinAt).toBeGreaterThan(0);
    const pinBlock = css.slice(pinAt, pinAt + 700);
    expect(pinBlock).toContain("position: fixed");
    expect(css).toContain(".chassis-slot { order: -1; height: 216px; }");
    // Desktop: the stage becomes a sticky rail instead.
    const desktopAt = css.indexOf("@media (min-width: 980px)");
    const stickyAt = css.indexOf("position: sticky", desktopAt);
    expect(desktopAt).toBeGreaterThan(0);
    expect(stickyAt).toBeGreaterThan(desktopAt);
    expect(stickyAt - desktopAt).toBeLessThan(800);
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
