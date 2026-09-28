import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { FONT_CATALOG, fontForOption } from "./fontCatalog";
import { GENERATED_FONTS } from "./glyphs.generated";
import { decodeConfig, encodeConfig, sanitizeConfig, shareUrl } from "./storage";
import { DEFAULT_CONFIG, type Config } from "./types";
import { buildYaml } from "./yaml";

const repoFile = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

/** Options of the Home Assistant "Clock font" select in packages/controls.yaml. */
function firmwareFontOptions(): string[] {
  const text = repoFile("packages/controls.yaml");
  const start = text.indexOf('name: "Clock font"');
  const rest = text.slice(start);
  const end = rest.indexOf("\n  - platform:");
  return [...rest.slice(0, end === -1 ? undefined : end).matchAll(/^ {6}- "(.+)"$/gm)].map((match) => match[1]);
}

/** Font ids declared in packages/fonts_local.yaml. */
function firmwareFontIds(): string[] {
  return [...repoFile("packages/fonts_local.yaml").matchAll(/^ {2}- id: (font_\w+)$/gm)].map((match) => match[1]);
}

describe("buildYaml", () => {
  it("creates one install YAML that loads every pinned firmware module", () => {
    const yaml = buildYaml(DEFAULT_CONFIG);

    expect(yaml).toContain("url: https://github.com/sandro-defender/Esphome-Max7219-Matrix-Clock");
    expect(yaml).toContain('ref: "0.1.0"');
    expect(yaml).toContain('project_ref: "0.1.0"');
    expect(yaml).toContain("- packages/base.yaml");
    expect(yaml).toContain("- packages/fonts_web.yaml");
    expect(yaml).toContain("- packages/ota_ui.yaml");
    expect(yaml).toContain("- packages/web_server.yaml");
    expect(yaml.split("\n").length).toBeLessThan(200);
  });

  it("stays synchronized with the checked-in release installer", () => {
    const generated = buildYaml(DEFAULT_CONFIG);
    const release = repoFile("examples/release.yaml");
    const packagePattern = /^\s+- (packages\/[a-z0-9_-]+\.yaml)$/gm;
    const filesFrom = (yaml: string) => [...yaml.matchAll(packagePattern)].map((match) => match[1]);

    expect(filesFrom(generated)).toEqual(filesFrom(release));
    expect(generated.match(/^\s+project_ref: "([^"]+)"$/m)?.[1]).toBe(
      release.match(/^\s+project_ref: "([^"]+)"$/m)?.[1],
    );
    expect(generated.match(/^\s+ref: "([^"]+)"$/m)?.[1]).toBe(release.match(/^\s+ref: "([^"]+)"$/m)?.[1]);
  });

  it("keeps credentials local and never emits built-in secret values", () => {
    const yaml = buildYaml(DEFAULT_CONFIG);

    expect(yaml).toContain("wifi_ssid: !secret wifi_ssid");
    expect(yaml).toContain("api_encryption_key: !secret api_encryption_key");
    expect(yaml).toContain("fallback_ap_password: !secret fallback_ap_password");
    expect(yaml).toContain("web_server_password: !secret web_server_password");
    expect(yaml).not.toMatch(/[A-Za-z0-9+/]{43}=/);
    expect(yaml).not.toContain("qrD7jAZbaZ38");
  });

  it("writes sanitized device and hardware substitutions", () => {
    const yaml = buildYaml({
      ...DEFAULT_CONFIG,
      deviceName: " Kitchen Clock!! ",
      friendlyName: 'Kitchen "Clock"\n',
      timezone: "Europe/Tbilisi",
      clkPin: "D5",
      mosiPin: "D7",
      csPin: "D8",
      chips: 8,
      rows: 2,
      brightness: 9,
    });

    expect(yaml).toContain("device_name: kitchen-clock");
    expect(yaml).toContain('friendly_name: "Kitchen Clock"');
    expect(yaml).toContain("timezone: Europe/Tbilisi");
    expect(yaml).toContain("matrix_clk_pin: D5");
    expect(yaml).toContain('matrix_chips: "8"');
    expect(yaml).toContain('matrix_rows: "2"');
    expect(yaml).toContain('matrix_intensity: "9"');
  });

  it("maps every preview preference to a package entity default", () => {
    const yaml = buildYaml({
      ...DEFAULT_CONFIG,
      screen: "Date",
      alignment: "Right",
      hourFormat: "12-hour",
      dateFormat: "DD/MM",
      secondsMode: "Bar",
      scrollMode: "Static",
    });

    expect(yaml).toContain("id: !extend screen_mode\n    initial_option: \"Date\"");
    expect(yaml).toContain("id: !extend clock_alignment\n    initial_option: \"Right\"");
    expect(yaml).toContain("id: !extend time_format\n    initial_option: \"12 hour\"");
    expect(yaml).toContain("id: !extend seconds_display\n    initial_option: \"Bar\"");
    expect(yaml).toContain("id: !extend date_format\n    initial_option: \"DD/MM\"");
    expect(yaml).toContain("id: !extend message_scroll_behavior\n    initial_option: \"Static\"");
    expect(yaml).toContain("id: !extend auto_cycle\n    restore_mode: RESTORE_DEFAULT_OFF");
  });

  it("keeps the numbers inside the ranges the package entities accept", () => {
    const yaml = buildYaml({
      ...DEFAULT_CONFIG,
      chips: 99,
      rows: 9,
      brightness: 40,
      nightBrightness: -5,
      animationMs: 99999,
      scrollSpeed: 5000,
      cycleInterval: 1,
      messageHold: 99999,
      nightStart: 99,
    });

    expect(yaml).toContain('matrix_chips: "16"');
    expect(yaml).toContain('matrix_rows: "4"');
    expect(yaml).toContain('matrix_intensity: "15"');
    expect(yaml).toContain('matrix_night_intensity: "0"');
    expect(yaml).toContain('animation_ms: "2000"');
    expect(yaml).toContain('message_ms_per_px: "200"');
    expect(yaml).toContain('screen_cycle_interval: "5"');
    expect(yaml).toContain('default_message_duration: "3600"');
    expect(yaml).toContain("initial_value: 23");
  });

  it("writes the selected font as the firmware option name", () => {
    for (const spec of FONT_CATALOG) {
      const yaml = buildYaml({ ...DEFAULT_CONFIG, clockFont: spec.id });
      expect(yaml).toContain(`id: !extend clock_font\n    initial_option: "${spec.option}"`);
    }
  });
});

describe("font catalog", () => {
  it("offers the bold Silkscreen clock face and retires the rejected faces", () => {
    const options = FONT_CATALOG.map((spec) => spec.option);
    expect(options).toContain("Silkscreen Bold");
    expect(options).not.toContain("Matrix Bold");
    expect(options).not.toContain("Eight Bit Dragon");
  });

  it("uses the bold clock face by default", () => {
    expect(DEFAULT_CONFIG.clockFont).toBe("silkscreen-bold");
    expect(buildYaml(DEFAULT_CONFIG)).toContain('initial_option: "Silkscreen Bold"');
  });

  it("offers exactly the options the firmware compiles", () => {
    expect([...FONT_CATALOG].map((spec) => spec.option).sort()).toEqual([...firmwareFontOptions()].sort());
  });

  it("maps every firmware font id to one catalog entry and one preview", () => {
    const ids = FONT_CATALOG.map((spec) => spec.firmwareId).filter((id): id is string => Boolean(id));
    expect(ids.sort()).toEqual([...firmwareFontIds()].sort());
    for (const id of ids) expect(GENERATED_FONTS[id]).toBeDefined();
    expect(Object.keys(GENERATED_FONTS).sort()).toEqual([...firmwareFontIds()].sort());
  });

  it("resolves options back to configurator ids", () => {
    for (const spec of FONT_CATALOG) expect(fontForOption(spec.option)).toBe(spec.id);
    expect(fontForOption("Comic Sans")).toBeNull();
  });

  it("keeps every face inside the 48 pixel budget of the default panel", () => {
    for (const spec of FONT_CATALOG) {
      const font = GENERATED_FONTS[spec.firmwareId ?? ""];
      const width = font ? font.clockWidth : 42;
      expect(width, spec.option).toBeLessThanOrEqual(48);
    }
  });

  it("rasterised glyphs cover the characters the firmware can print", () => {
    const required = "0123456789:.-/%!?+ ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (const [id, font] of Object.entries(GENERATED_FONTS)) {
      for (const char of required) {
        const key = char === " " ? "space" : char;
        expect(font.glyphs[key], `${id} is missing '${char}'`).toBeDefined();
      }
      for (const glyph of Object.values(font.glyphs)) {
        expect(glyph.rows.length).toBe(glyph.h);
        expect(glyph.advance).toBeGreaterThanOrEqual(0);
      }
      expect(font.inkHeight).toBeGreaterThan(0);
      expect(font.inkHeight).toBeLessThanOrEqual(8);
    }
  });
});

describe("settings storage", () => {
  it("round-trips a configuration through a share link", () => {
    const config: Config = { ...DEFAULT_CONFIG, chips: 8, rows: 2, clockFont: "silkscreen-bold", led: "Ice" };
    const url = shareUrl(config, "https://example.com/configurator");
    const encoded = url.split("#cfg=")[1];

    expect(url.startsWith("https://example.com/configurator#cfg=")).toBe(true);
    expect(decodeConfig(encoded)).toEqual(config);
  });

  it("falls back to defaults for unusable input", () => {
    expect(decodeConfig("not-base64!!")).toBeNull();
    expect(sanitizeConfig(null)).toEqual(DEFAULT_CONFIG);
    expect(sanitizeConfig({ chips: "many", rows: Number.NaN, invert: "yes" })).toEqual(DEFAULT_CONFIG);
  });

  it("clamps hostile values instead of trusting them", () => {
    const cleaned = sanitizeConfig({
      chips: 5000,
      brightness: -40,
      scrollSpeed: 1e9,
      nightStart: 99,
      screen: "Self destruct",
      clockFont: "../../etc/passwd",
      layoutPreview: "modules",
      extraKey: "dropped",
    });

    expect(cleaned.chips).toBe(16);
    expect(cleaned.brightness).toBe(0);
    expect(cleaned.scrollSpeed).toBe(200);
    expect(cleaned.nightStart).toBe(23);
    expect(cleaned.screen).toBe(DEFAULT_CONFIG.screen);
    expect(cleaned.clockFont).toBe(DEFAULT_CONFIG.clockFont);
    expect(cleaned.layoutPreview).toBe("modules");
    expect("extraKey" in cleaned).toBe(false);
  });

  it("encodes to a URL safe fragment", () => {
    const encoded = encodeConfig({ ...DEFAULT_CONFIG, friendlyName: "Küche & Bad / Uhr" });
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeConfig(encoded)?.friendlyName).toBe("Küche & Bad / Uhr");
  });
});
