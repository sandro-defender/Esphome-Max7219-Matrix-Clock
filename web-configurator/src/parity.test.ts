import { beforeAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { FIRMWARE, firmwareOption, optionsFor } from "./firmware";
import { FONT_CATALOG, previewFont } from "./fontCatalog";
import { DEFAULT_CONFIG, WEATHER_PREVIEW_OPTIONS, type Config } from "./types";
import { renderScene, renderStatusFrame, geometry, type Frame, type SlideFrame } from "./render";
import { normalizeMessage } from "./fonts";
import { dateInZone, previewDate } from "./usePreview";

const root = fileURLToPath(new URL("../../", import.meta.url));
const binary = `${root}tests/renderer_fixture`;
const date = new Date(2026, 9, 1, 12, 34, 56);
const config = (values: Partial<Config>): Config => ({ ...DEFAULT_CONFIG, ...values });
beforeAll(() => { execFileSync("make", ["-C", "tests", "fixture"], { cwd: root, stdio: "pipe" }); });

/** Oracle inputs use the real writer's generated preferences, not another hand-mapped Frame. */
function oracle(cfg: Config, now = date, from = "", elapsed = 0, overlay = "none", percent = 0, error = 0, version = FIRMWARE.releaseVersion) {
  const geo = geometry(cfg.chips, cfg.rows);
  const font = FIRMWARE.fonts.find((item) => item.id === cfg.clockFont)!;
  const values: Record<string, string | number> = Object.fromEntries(FIRMWARE.settings.map((item) =>
    [item.key, typeof cfg[item.key] === "string" ? firmwareOption(item.key, String(cfg[item.key])) : String(cfg[item.key])],
  ));
  Object.assign(values, { width: geo.width, height: geo.height, font: font.firmwareId ?? "compact", hour: now.getHours(), minute: now.getMinutes(),
    second: now.getSeconds(), day: now.getDate(), month: now.getMonth()+1, message: cfg.message, from, elapsed, overlay, percent, error, version,
    previewHomeTemperature: cfg.previewHomeTemperature, previewOutdoorTemperature: cfg.previewOutdoorTemperature,
    previewWeatherTemperature: cfg.previewWeatherTemperature, previewWeatherCondition: cfg.previewWeatherCondition });
  return JSON.parse(execFileSync(binary, Object.entries(values).map(([key, value]) => `${key}=${value}`), { encoding: "utf8" })) as { pixels: string; brightness: number; badWrites: number };
}
function visible(frame: Frame, cfg: Config): string {
  return [...frame.pixels].map((value) => !cfg.displayPower ? 0 : cfg.invert ? 1 - value : value).join("");
}
function compare(cfg: Config, now = date, slide: SlideFrame = { from: null, progress: 1 }, elapsed = 0) {
  const cpp = oracle(cfg, now, slide.from ?? "", elapsed);
  const scene = renderScene(cfg, now, 1000, slide, 1000 + elapsed);
  expect(visible(scene.frame, cfg), `${cfg.clockFont}/${cfg.screen} gap=${cfg.animationRowGap} elapsed=${elapsed}`).toBe(cpp.pixels);
  expect(scene.effectiveBrightness).toBe(cpp.brightness);
  expect(cpp.badWrites).toBe(0);
}

describe("exact firmware / browser pixel parity", () => {
  it("matches every face, screen, alignment, hour, seconds and date option on one and two rows", () => {
    for (const font of FONT_CATALOG) {
      for (const [chips, rows] of [[6, 1], [12, 2]]) {
        for (const screen of optionsFor("screen")) compare(config({ clockFont: font.id, chips, rows, screen: screen as Config["screen"] }));
        for (const key of ["alignment", "hourFormat", "secondsMode", "dateFormat"]) {
          for (const value of optionsFor(key)) compare(config({ clockFont: font.id, chips, rows, [key]: value, screen: key === "dateFormat" ? "Date" : "Clock" }));
        }
      }
    }
  }, 30000);

  it("matches the three 12-module weather Clock layouts, all icons and independent Date switches", () => {
    const clockLayouts = optionsFor("clockLayout");
    for (const clockLayout of clockLayouts) {
      for (const condition of WEATHER_PREVIEW_OPTIONS.map((item) => item.value)) {
        compare(config({ chips: 12, rows: 1, clockLayout, screen: "Clock", secondsMode: "Off", previewWeatherCondition: condition }));
      }
    }

    for (const [dateShowWeatherIcon, dateShowOutdoorTemperature] of [[false, false], [true, false], [false, true], [true, true]]) {
      compare(config({ chips: 12, rows: 1, clockFont: "pixel-clock-6x8", screen: "Date",
        dateFormat: "Weekday DD. MMM YY", dateShowWeatherIcon, dateShowOutdoorTemperature,
        previewWeatherCondition: "scattered clouds" as Config["previewWeatherCondition"] }));
    }

    // OpenWeatherMap descriptions use the same condition mapper; an invalid
    // dedicated sensor falls back to the weather entity's temperature attribute.
    compare(config({ chips: 12, rows: 1, clockLayout: "Clock + home and outdoor weather", screen: "Clock",
      previewWeatherCondition: "light rain" as Config["previewWeatherCondition"],
      previewHomeTemperature: "unavailable", previewOutdoorTemperature: "unknown", previewWeatherTemperature: "7.8" }));
    compare(config({ chips: 12, rows: 1, clockLayout: "Clock + home and outdoor weather", screen: "Clock",
      previewWeatherCondition: "unknown", previewHomeTemperature: "NaN", previewOutdoorTemperature: "unavailable",
      previewWeatherTemperature: "inf" }));
  }, 30000);

  it("matches all changed-digit rows, gaps and fallback/narrow geometries with no ghost ink", () => {
    for (const font of FONT_CATALOG) for (const gap of [0, 1, 2]) for (const chips of [2, 4, 6]) {
      const cfg = config({ clockFont: font.id, chips, animationRowGap: gap, blinkColon: false });
      const settled = renderScene(cfg, date, date.getTime());
      const from = settled.content.length === 8 ? "12:34:55" : "12:33";
      for (const elapsed of [0, 20, 80, 140, 200, 300, 400, 500, 580, 600]) {
        compare(cfg, date, { from, progress: elapsed/cfg.animationMs }, elapsed);
      }
    }
  }, 30000);

  it("matches native MAX7219 transmission for all rotations, local flips and inversion", () => {
    for (const rotateChip of FIRMWARE.settings.find((item) => item.key === "rotateChip")!.options!) {
      for (const flipX of [false, true]) for (const invert of [false, true]) {
        compare(config({ rotateChip: Number(rotateChip) as Config["rotateChip"], flipX, invert, clockFont: "matrix-2px" }));
      }
    }
  });

  it("reverses the chip chain when a 180-degree rotation needs digit positions swapped", () => {
    compare(config({ rotateChip: 180, reverseEnable: true, clockFont: "matrix-2px" }));
  });

  it("matches ASCII, spaces, unsupported/UTF-8 text, scrolling and timeout", () => {
    for (const clockFont of FONT_CATALOG.map((font) => font.id)) for (const message of ["HI  THERE", "0123456", "LONG MESSAGE SCROLLS ACROSS THE PANEL", " a🙂აბ b "]) {
      for (const scrollMode of ["Scroll", "Static"] as const) for (const elapsed of [0, 120, 3000, 15000]) compare(config({ clockFont, message, scrollMode }), date, undefined, elapsed);
    }
  }, 30000);

  it("preserves stationary digits and colon columns during each slide frame", () => {
    for (const key of FONT_CATALOG.map((font) => font.id)) {
      const cfg = config({ clockFont: key, blinkColon: false });
      const settled = renderScene(cfg, date, date.getTime());
      const cells = settled.layout!.cells;
      const stationary = cells.slice(0, -1);
      for (const elapsed of [20, 80, 200, 400, 580]) {
        const sliding = renderScene(cfg, date, date.getTime(), { from: "12:34:55", progress: elapsed/cfg.animationMs });
        for (const cell of stationary) for (let y = 0; y < settled.frame.height; y++) for (let x = cell.x; x < cell.x+cell.advance; x++)
          expect(sliding.frame.pixels[y*48+x], `${key} ${cell.char}`).toBe(settled.frame.pixels[y*48+x]);
      }
    }
  });

  it("matches disabled/zero-duration animation, power, manual/scheduled night and alarm phases", () => {
    for (const cfg of [config({ digitAnimation: false }), config({ animationMs: 0 }), config({ displayPower: false, invert: true }),
      config({ nightManual: true }), config({ nightDim: true, nightStart: 0, nightEnd: 23 }), config({ nightDim: true, nightStart: 7, nightEnd: 7 }), config({ alarmMode: true })]) {
      for (const elapsed of [0, 20, 500, 600]) compare(cfg, date, { from: "12:34:55", progress: elapsed/600 }, elapsed);
    }
  });

  it("matches boot and OTA status pixels using the actual C++ text templates / packed fallback", () => {
    for (const chips of [2, 4, 6]) for (const percent of [0, 1, 42.9, 99, 100, 255]) {
      const cfg = config({ chips, displayPower: false, invert: true, nightManual: true, nightBrightness: 0, otaBrightness: 0, alarmMode: true });
      const { width, height } = geometry(chips, 1);
      for (const state of Object.values(FIRMWARE.renderer.otaStates).filter((id) => id !== 0)) {
        const cpp = oracle(cfg, date, "", 500, String(state), percent, 3);
        const frame = renderStatusFrame(width, height, { type: "ota", state, percent, error: 3 });
        expect([...frame.pixels].join(""), `OTA ${state}/${percent}/${width}`).toBe(cpp.pixels);
        expect(cpp.brightness).toBe(1);
      }
    }
    const version = FIRMWARE.releaseVersion;
    for (const elapsed of [0, 25, 600, 2499]) {
      const cfg = config({ displayPower: false, invert: true, brightness: 0 });
      const cpp = oracle(cfg, date, "", elapsed, "boot", 0, 0, version);
      const frame = renderStatusFrame(48, 8, { type: "boot", version, elapsedMs: elapsed });
      expect([...frame.pixels].join("")).toBe(cpp.pixels);
      expect(cpp.brightness).toBe(1);
    }
  }, 30000);

  it("keeps Matrix 2px zero's repaired upper-left 2×2 stroke and the original 8-row height", () => {
    const zero = previewFont("matrix-2px").glyph("0")!;
    expect(zero.h).toBe(8);
    const left = 3 << (zero.w-2);
    expect(zero.rows[0] & left).toBe(left);
    expect(zero.rows[1] & left).toBe(left);
  });

  it("preserves message spaces/bytes and converts live time to the selected zone with DST", () => {
    expect(normalizeMessage(" hi  there\n ")).toBe(" HI  THERE\n ");
    expect(new TextEncoder().encode(normalizeMessage("A".repeat(46)+"🙂")).length).toBe(46);
    expect(dateInZone(new Date("2026-10-01T12:00:00Z"), "Europe/Berlin").getHours()).toBe(14);
    expect(dateInZone(new Date("2026-12-01T12:00:00Z"), "Europe/Berlin").getHours()).toBe(13);
    expect(previewDate("9:05:07", date).getHours()).toBe(9);
  });
});
