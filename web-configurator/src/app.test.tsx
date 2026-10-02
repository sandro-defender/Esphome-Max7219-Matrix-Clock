import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync, readdirSync } from "node:fs";
import App from "./App";
import { FONT_CATALOG } from "./fontCatalog";
import { DEFAULT_FONTS, EXTRA_FONTS, addExtraFontAndSelect } from "./fontSelection";
import { DEFAULT_CONFIG } from "./types";
import { FIRMWARE, PROJECT } from "./firmware";
import { TuneSection } from "./sections";
import { geometry } from "./render";

const configIds = ["preview", "tune", "font-lab"];
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
  it("renders every generated firmware control and option, with extras enabled together", () => {
    let cfg = DEFAULT_CONFIG;
    for (const id of EXTRA_FONTS) cfg = addExtraFontAndSelect(cfg, id);
    const tune = renderToStaticMarkup(<TuneSection cfg={cfg} patch={() => {}} geo={geometry(cfg.chips, cfg.rows)} />);
    for (const item of FIRMWARE.settings) expect(tune, item.key).toContain(item.label.replace(/&/g, "&amp;"));
    for (const spec of FONT_CATALOG) expect(tune, spec.label).toContain(spec.label);
    // One selectable hardware target per generated contract entry, first selected.
    expect(tune).toContain('role="radiogroup" aria-label="Hardware target"');
    for (const target of FIRMWARE.hardwareTargets) expect(tune, target.id).toContain(target.label);
    const selected = /aria-checked="true"[\s\S]*?<strong>([^<]+)<\/strong>/.exec(tune);
    expect(selected?.[1]).toBe(FIRMWARE.hardwareTargets.find((target) => target.id === FIRMWARE.defaultTarget)!.label);
    expect(DEFAULT_FONTS).toEqual(["pixel-clock-6x8", "matrix-2px"]);
    expect(markup.match(/type="checkbox" disabled="" checked=""/g)).toHaveLength(2);
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

  });
});
