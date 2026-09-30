import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import App from "./App";
import { FONT_CATALOG } from "./fontCatalog";
import { DEFAULT_FONTS, EXTRA_FONTS, addExtraFontAndSelect, normalizeFonts, toggleExtraFont } from "./fontSelection";
import { decodeConfig, encodeConfig, loadConfig, sanitizeConfig, saveConfig, shareUrl } from "./storage";
import { DEFAULT_CONFIG, type Config } from "./types";
import { buildYaml, INSTALLER_READY } from "./yaml";

afterEach(() => vi.unstubAllGlobals());

describe("firmware font inclusion", () => {
  it("shows Georgian candidates as preview-only rather than installer choices", () => {
    const markup = renderToStaticMarkup(<App />);
    expect(markup).toContain("Font lab · test candidates");
    expect(markup).toContain("Noto Sans Georgian");
    expect(markup).toContain("Noto Serif Georgian");
    expect(markup).toContain("preview only");
    expect(markup).toContain("Audiowide");
    expect(markup).toContain("Bitcount Grid Double");
  });

  it("defaults to Matrix 2px and Dot Matrix, with Dot Matrix active", () => {
    expect(DEFAULT_CONFIG.fonts).toEqual(DEFAULT_FONTS);
    expect(DEFAULT_CONFIG.clockFont).toBe("dot-matrix");
    expect(normalizeFonts([])).toEqual(DEFAULT_FONTS);
    expect(normalizeFonts(null)).toEqual(DEFAULT_FONTS);
    expect(DEFAULT_CONFIG.animationMs).toBe(600);
  });

  it("permits three extras, rejects a fourth without replacing earlier choices", () => {
    let cfg = sanitizeConfig(null);
    for (const font of ["handjet", "oxanium", "teko"] as const) cfg = toggleExtraFont(cfg, font);
    expect(cfg.fonts).toHaveLength(5);
    expect(toggleExtraFont(cfg, "jersey-15")).toBe(cfg);
    cfg = toggleExtraFont(cfg, "teko");
    expect(toggleExtraFont(cfg, "jersey-15").fonts).toContain("jersey-15");
    for (const font of [...DEFAULT_FONTS, "compact"] as const) expect(toggleExtraFont(cfg, font)).toBe(cfg);
  });

  it("selects a newly checked font for the live matrix preview", () => {
    const cfg = addExtraFontAndSelect(sanitizeConfig(null), "handjet");
    expect(cfg.fonts).toContain("handjet");
    expect(cfg.clockFont).toBe("handjet");
  });

  it("removing the active extra resets only the active face to Dot Matrix", () => {
    const cfg = sanitizeConfig({ fonts: ["handjet"], clockFont: "handjet", brightness: 9 });
    const next = toggleExtraFont(cfg, "handjet");
    expect(next.clockFont).toBe("dot-matrix");
    expect(next.brightness).toBe(9);
    expect(next.fonts).toEqual(DEFAULT_FONTS);
  });

  it("preserves an old link's active external face as an extra", () => {
    expect(sanitizeConfig({ clockFont: "handjet" }).fonts).toEqual([...DEFAULT_FONTS, "handjet"]);
    expect(sanitizeConfig({ clockFont: "compact" }).clockFont).toBe("compact");
  });

  it("round-trips extras through share links and localStorage", () => {
    const cfg = sanitizeConfig({ fonts: ["teko", "handjet", "oxanium"], clockFont: "handjet" });
    expect(decodeConfig(shareUrl(cfg).split("#cfg=")[1])).toEqual(cfg);
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", { setItem: (k: string, v: string) => store.set(k, v), getItem: (k: string) => store.get(k) });
    saveConfig(cfg);
    expect(loadConfig()).toEqual({ config: cfg, from: "saved" });
    vi.stubGlobal("window", { location: { hash: shareUrl(cfg) } });
    expect(loadConfig()).toEqual({ config: cfg, from: "link" });
  });

  it("reset restores two defaults without sharing a mutable default array", () => {
    const reset = sanitizeConfig(null);
    expect(reset).toEqual(DEFAULT_CONFIG);
    reset.fonts.push("teko");
    expect(DEFAULT_CONFIG.fonts).toEqual(DEFAULT_FONTS);
  });

  it("sanitizes malformed, oversized and hostile inclusion arrays", () => {
    for (const input of [false, 42, "teko", {}, null, [], [null, {}, "../../evil", "compact"],
      Array(1000).fill("teko"), [...EXTRA_FONTS].reverse(), [...EXTRA_FONTS, ...EXTRA_FONTS]]) {
      const hostile = { ...DEFAULT_CONFIG, fonts: input, clockFont: "handjet" } as unknown as Config;
      const cleaned = decodeConfig(encodeConfig(hostile))!;
      expect(cleaned.fonts.slice(0, 2)).toEqual(DEFAULT_FONTS);
      expect(cleaned.fonts.length).toBeLessThanOrEqual(5);
      expect(new Set(cleaned.fonts).size).toBe(cleaned.fonts.length);
      expect(cleaned.fonts).toContain(cleaned.clockFont);
      expect(sanitizeConfig(cleaned)).toEqual(cleaned);
      expect(buildYaml(cleaned)).not.toContain("../../evil");
    }
  });

  it("lists only the chosen face packages for defaults, one extra and three extras", () => {
    for (const extras of [[], ["handjet"], ["teko", "handjet", "oxanium"]]) {
      const cfg = sanitizeConfig({ fonts: extras });
      const yaml = buildYaml(cfg);
      const paths = [...yaml.matchAll(/- packages\/fonts\/([a-z0-9-]+)\.yaml/g)].map((m) => m[1]);
      expect(paths).toEqual(cfg.fonts);
      expect(yaml).not.toContain("fonts_web.yaml");
      expect(yaml).not.toMatch(/^font:/m);
      for (const id of cfg.fonts) expect(FONT_CATALOG.find((s) => s.id === id)?.firmwareId).toBeTruthy();
    }
  });

  it("normalizes direct generator calls as well as storage", () => {
    const yaml = buildYaml({ ...DEFAULT_CONFIG, fonts: [], clockFont: "handjet" });
    expect(yaml).toContain('id: !extend clock_font\n    initial_option: "Dot Matrix"');
    expect(yaml).not.toContain("fonts/handjet.yaml");
  });

  it("enables installer export for published 0.4.0 and exposes labeled extra checkboxes", () => {
    expect(INSTALLER_READY).toBe(true);
    const yaml = buildYaml(DEFAULT_CONFIG);
    expect(yaml).not.toContain("DRAFT");
    expect(yaml).not.toContain("unpublished");
    const markup = renderToStaticMarkup(<App />);
    expect(markup).toContain("Fonts included in firmware");
    expect(markup.match(/type="checkbox"/g)).toHaveLength(8);
    expect(markup).toContain("Add up to three other fonts");
    expect(markup).not.toContain("Installer copy/download is disabled");
    expect(markup).not.toContain("DRAFT");
    expect(markup).toMatch(/<button(?![^>]*disabled)[^>]*>Copy install YAML/);
  });
});
