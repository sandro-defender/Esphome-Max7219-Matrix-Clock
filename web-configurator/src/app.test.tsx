import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync, readdirSync } from "node:fs";
import App from "./App";
import { FONT_CATALOG } from "./fontCatalog";
import { DEFAULT_FONTS, EXTRA_FONTS, addExtraFontAndSelect } from "./fontSelection";
import { DEFAULT_CONFIG, WEATHER_PREVIEW_OPTIONS } from "./types";
import { FIRMWARE, PROJECT } from "./firmware";
import { TuneSection } from "./sections";
import { geometry } from "./render";

const configIds = ["preview", "tune", "entity-visibility", "font-lab"];
const infoIds = ["hardware", "install", "assistant", "troubleshooting", "gallery", "docs", "font-reference", "release-notes"];

describe("App", () => {
  const markup = renderToStaticMarkup(<App />);
  const info = renderToStaticMarkup(<App initialPage="info" />);
  it("keeps Configure strictly to settings / live preview, with all documentation in Info & help", () => {
    for (const id of configIds) expect(markup).toContain(`id="${id}"`);
    for (const id of infoIds) { expect(markup).not.toContain(`id="${id}"`); expect(info).toContain(`id="${id}"`); }
    for (const id of configIds) expect(info).not.toContain(`id="${id}"`);
    expect(markup).not.toContain("secrets.yaml");
    expect(markup).not.toContain("Default wiring");
    expect(markup).not.toContain("Install in five steps");
    expect(markup).not.toContain("section-lead");
  });
  it("labels the shell, selected font and exactly one h1 on each page", () => {
    expect(markup).toContain("Clock<span>lab</span>");
    expect(markup).toContain('aria-label="Configurator pages"');
    expect(markup).toContain('aria-label="Preview status"');
    expect(markup.match(/<h1/g)).toHaveLength(1);
    expect(info.match(/<h1/g)).toHaveLength(1);
    for (const id of [...configIds, ...infoIds]) expect(markup + info).toContain(`aria-labelledby="${id}-title"`);
  });
  it("gives both top-level pages a clear intro and exposes the current navigation page", () => {
    expect(markup).toContain('class="configure-intro"');
    expect(markup).toContain("Design your ");
    expect(markup.match(/aria-current="page"/g)).toHaveLength(1);
    expect(info.match(/aria-current="page"/g)).toHaveLength(1);
    expect(markup).toContain('class="release-status checking"');
    expect(markup).toContain("Newest published release:");
    expect(info).toContain('class="info-intro"');
    expect(info).toContain("Project guide");
  });
  it("renders every generated firmware control and option, with extras enabled together", () => {
    let cfg = DEFAULT_CONFIG;
    for (const id of EXTRA_FONTS) cfg = addExtraFontAndSelect(cfg, id);
    const tune = renderToStaticMarkup(<TuneSection cfg={cfg} patch={() => {}} geo={geometry(cfg.chips, cfg.rows)} />);
    for (const item of FIRMWARE.settings) expect(tune, item.key).toContain(item.label.replace(/&/g, "&amp;"));
    for (const spec of FONT_CATALOG) expect(tune, spec.label).toContain(spec.label);
    // One selectable hardware target per generated contract entry, first selected.
    expect(tune).toContain('role="radiogroup" aria-label="Hardware target"');
    for (const target of FIRMWARE.hardwareTargets) expect(tune, target.id).toContain(target.label);
    const selected = /type="radio"[^>]*checked=""[^>]*>[\s\S]*?<strong>([^<]+)<\/strong>/.exec(tune);
    expect(selected?.[1]).toBe(FIRMWARE.hardwareTargets.find((target) => target.id === FIRMWARE.defaultTarget)!.label);
    expect(DEFAULT_FONTS).toEqual(["max7219"]);
    expect(markup.match(/type="checkbox" disabled="" checked=""/g)).toHaveLength(1);
    expect(markup).toContain("data-font-screens");
    expect(markup).toContain("data-font-charsets");
    for (const charset of ["standardDigits", "customBigDigits", "englishUpper", "englishLower", "georgian", "punctuation"]) {
      expect(markup).toContain(`data-charset="${charset}"`);
    }
  });
  it("offers preview-only indoor/outdoor samples and every weather icon without querying Home Assistant", () => {
    for (const id of ["preview-weather-condition", "preview-home-temperature", "preview-outdoor-temperature", "preview-weather-temperature"])
      expect(markup).toContain(`id=\"${id}\"`);
    for (const option of WEATHER_PREVIEW_OPTIONS) expect(markup).toContain(option.label);
    expect(markup).toContain("never query Home Assistant or enter installer YAML");
    expect(markup).toContain("blank or invalid temperatures show the safe placeholder");
  });
  it("shows the newest-release check and disables installer actions until verified", () => {
    expect(markup).toContain("Newest published release:");
    expect(markup).toContain("Checking newest published release");
    expect(markup).toMatch(/disabled=""><span[^>]*>Copy install YAML/);
    expect(markup).toMatch(/disabled="">Download YAML/);
    expect(info).toContain(FIRMWARE.esphomeVersion);
    expect(info).toContain(FIRMWARE.releaseVersion);
    expect(info).toContain(FIRMWARE.releaseNotes.split("\n")[0]);
  });
  it("preserves hardware, security, entities, release notes and documentation without credential inputs", () => {
    for (const secret of Object.values(FIRMWARE.secrets)) expect(info).toContain(secret);
    for (const entity of FIRMWARE.entities) expect(info).toContain(entity.name);
    for (const action of FIRMWARE.actions) expect(info).toContain(action.action);
    for (const url of [PROJECT.readme, PROJECT.validation, PROJECT.roadmap, PROJECT.issues]) expect(info).toContain(url);
    expect(info).toContain("Common ground with the matrix is mandatory");
    expect(info).toContain("encrypted native OTA");
    expect(markup + info).not.toContain('type="password"');
  });
  it("folds every Info & help reference table by default, one table per disclosure", () => {
    // The five reference tables (wiring, package contract, actions, entities,
    // fonts) each sit in one disclosure that starts closed, so the page stays
    // short until a table is actually opened.
    const folds = [...info.matchAll(/<details class="table-fold"[^>]*>/g)];
    expect(folds).toHaveLength(5);
    for (const match of folds) expect(match[0]).not.toContain("open");
    for (const [label, rows] of [["Wiring", "5 rows"], ["Package contract", undefined], ["Actions", undefined], ["Entities", undefined], ["Fonts", undefined]] as const) {
      const fold = [...info.matchAll(new RegExp(`<details class="table-fold"[^>]*><summary><span>${label}</span><span class="table-fold-count">[\\d]+ rows?</span>`, "g"))];
      expect(fold, label).toHaveLength(1);
      if (rows) expect(fold[0][0]).toContain(rows);
    }
    // Each disclosure contains exactly one table and no nested disclosure.
    for (const match of info.matchAll(/<details class="table-fold"[^>]*>[\s\S]*?<\/details>/g)) {
      const [block] = match;
      const body = block.slice(block.indexOf(">") + 1, -"</details>".length);
      expect(body.match(/<table class="pin-table">/g)).toHaveLength(1);
      expect(body).not.toContain("<details");
    }
    expect(info).not.toMatch(/<details class="table-fold"[^>]*open/);
  });
  it("retains every shipped hardware photo with meaningful alt and caption, only in Info & help", () => {
    const files = readdirSync(new URL("../public/images", import.meta.url)).filter((name) => name.endsWith(".jpg")).sort();
    const figures = [...info.matchAll(/<figure[^>]*>\s*<img src="\.\/images\/([\w.-]+)" alt="([^"]+)"[^>]*\/?>\s*<figcaption>([^<]+)<\/figcaption>/g)];
    expect(figures.map((match) => match[1]).sort()).toEqual(files);
    for (const [, file, alt, caption] of figures) { expect(alt.length, file).toBeGreaterThan(40); expect(caption.length, file).toBeGreaterThan(20); }
  });
});

/* ------------------------------------------------------------------ *
 * Layout contract
 *
 * Parsed out of index.css and the rendered markup instead of eyeballed, so a
 * spacing or stacking regression fails here rather than on a phone.
 * ------------------------------------------------------------------ */

const DESKTOP = "@media (min-width: 980px)";

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
    // The page title sits below the stage: no block of text is stacked above
    // the panel, so the first screen is the pinned matrix itself.
    expect(markup.indexOf("<h1")).toBeGreaterThan(status);
  });

  it("keeps the essential preview controls above the fold under the matrix", () => {
    const controls = markup.indexOf('id="preview-time"');
    const composer = markup.indexOf('id="ha-message"');
    const tune = markup.indexOf('<section id="tune"');

    expect(controls).toBeGreaterThan(0);
    expect(composer).toBeGreaterThan(0);
    expect(controls).toBeLessThan(tune);
    expect(composer).toBeLessThan(tune);
    // They live in the content column under the stage, never before it.
    expect(markup.indexOf('class="content-col"')).toBeLessThan(controls);
  });

  it("keeps the page one full-width column with the pinned matrix at every width", () => {
    // No preview rail beside the content: the shell defines no two-column
    // grid, the matrix is pinned under the menu exactly as on phones, and the
    // settings and reference content below it use the whole page width.
    expect(rule(css, ".shell")).not.toContain("display: grid");
    expect(rule(css, ".shell", DESKTOP)).not.toContain("grid-template-columns");
    expect(rule(css, ".chassis")).toContain("position: fixed");
    expect(rule(css, ".chassis")).toContain("top: calc(var(--pin-top) + var(--pin-gap))");
    // Capped — but a pixel table wider than the cap (many modules) pushes the
    // chassis to the page edges through --matrix-w instead of scaling down.
    expect(rule(css, ".chassis")).toContain("max-width: max(var(--chassis-cap), var(--matrix-w, 0px))");
    expect(rule(css, ":root")).toContain("--chassis-cap: 640px");
    // Large screens get a bigger matrix, phones keep the 640 px cap.
    expect(rule(css, ":root", DESKTOP)).toContain("--chassis-cap: 720px");
    expect(rule(css, ".topbar")).toContain("padding: 12px 16px 8px");
  });

  it("pins the matrix under the measured chrome and under the menu", () => {
    const chassis = rule(css, ".chassis");
    expect(chassis).toContain("position: fixed");
    expect(chassis).toContain("top: calc(var(--pin-top) + var(--pin-gap))");
    expect(chassis).toContain("z-index: 40");
    expect(chassis).toContain("env(safe-area-inset-left");
    // Centred, and capped by --chassis-cap unless the pixel table is wider.
    expect(chassis).toContain("left: 50%");
    expect(chassis).toContain("max-width: max(var(--chassis-cap), var(--matrix-w, 0px))");

    const nav = rule(css, ".site-nav");
    expect(nav).toContain("position: sticky");
    expect(nav).toContain("top: 0");
    expect(nav).toContain("env(safe-area-inset-top");
    // Stacking and opacity: the menu paints over the matrix, never through it.
    expect(Number(/z-index: (\d+)/.exec(nav)![1])).toBeGreaterThan(40);
    expect(Number(/rgba\(16, 14, 12, ([\d.]+)\)/.exec(nav)![1])).toBeGreaterThanOrEqual(0.95);

    // The spacer keeps the document height honest while the chassis is fixed.
    expect(rule(css, ".chassis-slot")).toContain("height: var(--chassis-h)");
    expect(markup).toContain('class="chassis-slot"');
    // A measured inline height used to override the reserved spacer.
    const stage = readFileSync(new URL("./LiveStage.tsx", import.meta.url), "utf8");
    expect(stage).not.toContain("style={chassisH");
  });

  it("gives anchor jumps room for the menu and the pinned matrix", () => {
    expect(rule(css, "html")).toContain("scroll-padding-top: calc(var(--nav-h) + 12px)");
    expect(rule(css, ".doc-section")).toContain("var(--chassis-h)");
  });

  it("collapses the pinned display to just the pixel table while scrolled", () => {
    // The scroll state is measured in the stage, the bezel furniture is
    // hidden by CSS; the measured --chassis-h slot follows the shorter box.
    const stage = readFileSync(new URL("./LiveStage.tsx", import.meta.url), "utf8");
    expect(stage).toContain("addEventListener(\"scroll\"");
    expect(stage).toContain("chassis\", scrolled && \"compact\"");
    expect(stage).toContain("naturalPanelWidth");
    expect(css).toContain(".chassis.compact { padding: 6px 12px; }");
    for (const part of [".chassis-top", ".chassis-bottom", ".screw", ".halo"]) {
      expect(css).toContain(`.chassis.compact ${part}`);
    }
    expect(css).toContain(".chassis.compact .halo { display: none; }");
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

  });
  it("keeps responsive alignment, readable controls, focus indicators and compact spacing in CSS", () => {
    expect(css).toContain("grid-template-columns: var(--label-width) minmax(0, 1fr)");
    expect(css).toContain("minmax(min(100%, 340px), 1fr)");
    expect(css).toContain("grid-template-columns: minmax(0, 1fr) 6.3rem");
    expect(css).toContain("@media (max-width: 479px)");
    expect(css).toContain("font-size: 16px; min-height: 44px");
    expect(css).toContain(":focus-visible");
    expect(css).toContain("animation-duration: 0.01ms !important");
    expect(rule(css, '.composer input[type="text"]:focus')).not.toContain("outline: none");
    expect(css).not.toContain(".setting-row { display: none");
  });
});
