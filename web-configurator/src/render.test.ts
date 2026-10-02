import { describe, expect, it } from "vitest";

import { FONT_CATALOG, previewFont } from "./fontCatalog";
import { clockContent, dateContent, geometry, renderScene, type Frame } from "./render";
import { DEFAULT_CONFIG, type Config } from "./types";

const at = (frame: Frame, x: number, y: number) => (y * frame.width + x < frame.pixels.length ? frame.pixels[y * frame.width + x] : 0);
const lit = (frame: Frame) => frame.pixels.reduce((total, value) => total + (value > 0 ? 1 : 0), 0);

const NOON = new Date(2026, 0, 2, 12, 34, 56);
const MORNING = new Date(2026, 0, 2, 9, 5, 7);

function sceneWith(overrides: Partial<Config>, now: Date = NOON) {
  return renderScene({ ...DEFAULT_CONFIG, ...overrides }, now, Date.now());
}

describe("geometry", () => {
  it("turns module counts into pixel sizes", () => {
    expect(geometry(6, 1)).toMatchObject({ width: 48, height: 8, modulesX: 6, modulesY: 1, valid: true });
    expect(geometry(8, 2)).toMatchObject({ width: 32, height: 16, modulesX: 4, modulesY: 2, valid: true });
  });

  it("flags a module count that does not divide into rows", () => {
    expect(geometry(7, 2).valid).toBe(false);
    expect(geometry(7, 2).width).toBe(56);
  });
});

describe("clock and date text", () => {
  it("formats the clock the way the firmware does", () => {
    expect(clockContent(NOON, DEFAULT_CONFIG, true)).toBe("12:34:56");
    expect(clockContent(NOON, DEFAULT_CONFIG, false)).toBe("12:34");
  });

  it("blanks the leading digit in 12-hour mode", () => {
    const cfg = { ...DEFAULT_CONFIG, hourFormat: "12-hour" as const };
    expect(clockContent(MORNING, cfg, true)).toBe(" 9:05:07");
    expect(clockContent(new Date(2026, 0, 2, 0, 30, 0), cfg, false)).toBe("12:30");
  });

  it("formats the date in every supported order", () => {
    expect(dateContent(NOON, DEFAULT_CONFIG)).toBe("02.01");
    expect(dateContent(NOON, { ...DEFAULT_CONFIG, dateFormat: "MM/DD" })).toBe("01/02");
    expect(dateContent(NOON, { ...DEFAULT_CONFIG, dateFormat: "DD/MM" })).toBe("02/01");
    expect(dateContent(NOON, { ...DEFAULT_CONFIG, dateFormat: "DD.MM.YY" })).toBe("02.01.26");
    expect(dateContent(NOON, { ...DEFAULT_CONFIG, dateFormat: "Weekday DD.MM.YY" })).toBe("FRI 02.01.26");
    expect(dateContent(NOON, { ...DEFAULT_CONFIG, dateFormat: "Weekday DD. MMM YY" })).toBe("FRI 02. JAN 26");
  });
});

describe("renderScene", () => {
  it("paints a clock on the default 6 module panel", () => {
    const scene = sceneWith({});
    expect(scene.page).toBe("clock");
    expect(scene.geometry.width).toBe(48);
    expect(scene.withSeconds).toBe(true);
    expect(lit(scene.frame)).toBeGreaterThan(20);
    expect(scene.notices.filter((notice) => notice.level === "warn")).toHaveLength(0);
  });

  it("keeps every font inside the 48x8 panel without fallback", () => {
    for (const { id: clockFont } of FONT_CATALOG) {
      const scene = sceneWith({ clockFont, secondsMode: "Off" });
      const font = previewFont(clockFont);
      const boxTop = font.boxTop(8);
      const rows = scene.frame.pixels
        .reduce<number[]>((acc, value, index) => {
          if (value > 0) acc.push(Math.floor(index / scene.frame.width));
          return acc;
        }, [])
        .filter((row, index, all) => all.indexOf(row) === index);
      expect(rows.length, clockFont).toBeGreaterThan(0);
      // The firmware places ink at box_top + glyph.offset_y. Punctuation can
      // legitimately sit below the digit-only metrics (Doto's colon reaches
      // row 7), but no selected face may paint outside the eight matrix rows.
      const first = boxTop + font.inkTop;
      expect(Math.min(...rows), `${clockFont} first lit row`).toBeGreaterThanOrEqual(first - 1);
      expect(Math.min(...rows), `${clockFont} first lit row`).toBeGreaterThanOrEqual(0);
      expect(Math.max(...rows), `${clockFont} last lit row`).toBeLessThan(8);
      expect(scene.usedFallback).toBe(false);
    }
  });

  it("falls back to the built-in font when the panel is too narrow", () => {
    const scene = sceneWith({ chips: 2, clockFont: "matrix-2px" });
    expect(scene.usedFallback).toBe(true);
    expect(scene.notices.some((notice) => notice.level === "warn")).toBe(true);
    expect(lit(scene.frame)).toBeGreaterThan(0);
  });

  it("drops the seconds before it falls back", () => {
    const scene = sceneWith({ chips: 4, clockFont: "matrix-2px" });
    expect(scene.geometry.width).toBe(32);
    expect(scene.usedFallback).toBe(false);
    expect(scene.droppedSeconds).toBe(true);
    expect(scene.withSeconds).toBe(false);
  });

  it("draws the seconds as a bottom row bar", () => {
    const full = sceneWith({ secondsMode: "Digits" });
    const bar = sceneWith({ secondsMode: "Bar" });
    expect(lit(bar.frame)).toBeGreaterThan(0);
    expect(bar.frame.pixels.slice(bar.frame.width * 7).some((value) => value > 0)).toBe(true);
    expect(lit(full.frame)).toBeGreaterThan(0);
  });

  it("blinks the colon away on odd seconds", () => {
    const oddSecond = new Date(2026, 0, 2, 12, 34, 55);
    const blinked = sceneWith({}, oddSecond);
    const steady = sceneWith({ blinkColon: false }, oddSecond);
    const evenSecond = sceneWith({}, new Date(2026, 0, 2, 12, 34, 56));
    expect(lit(blinked.frame)).toBeLessThan(lit(steady.frame));
    expect(lit(blinked.frame)).toBeLessThan(lit(evenSecond.frame));
  });

  it("renders the date screen with the selected format", () => {
    const scene = sceneWith({ screen: "Date", dateFormat: "MM/DD" });
    expect(scene.page).toBe("date");
    expect(lit(scene.frame)).toBeGreaterThan(0);
  });

  it("uses the independent date-scroll-speed setting for weekday dates", () => {
    const base = { ...DEFAULT_CONFIG, screen: "Date" as const, dateFormat: "Weekday DD. MMM YY" as const };
    const fast = renderScene({ ...base, dateScrollSpeed: 20 }, NOON, 0, { from: null, progress: 1 }, 1000);
    const slow = renderScene({ ...base, dateScrollSpeed: 200 }, NOON, 0, { from: null, progress: 1 }, 1000);
    expect(fast.frame.pixels).not.toEqual(slow.frame.pixels);
  });

  it("shows the temperature placeholder until Home Assistant supplies a value", () => {
    const scene = sceneWith({ screen: "Temperature" });
    expect(scene.page).toBe("temperature");
    expect(scene.content).toBe("--.-");
  });

  it("lets an active message take the whole display", () => {
    const now = Date.now();
    const active = renderScene({ ...DEFAULT_CONFIG, message: "tea ready", messageHold: 30 }, new Date(now), now);
    const expired = renderScene({ ...DEFAULT_CONFIG, message: "tea ready", messageHold: 1 }, new Date(now), now - 5000);
    expect(active.page).toBe("message");
    expect(active.messageActive).toBe(true);
    expect(expired.page).toBe("clock");
  });

  it("holds a message forever when the duration is zero", () => {
    const now = Date.now();
    const scene = renderScene({ ...DEFAULT_CONFIG, message: "hello", messageHold: 0 }, new Date(now), now - 60_000);
    expect(scene.messageActive).toBe(true);
    expect(scene.messageHoldLeft).toBeNull();
  });

  it("draws the firmware test patterns", () => {
    const grid = sceneWith({ screen: "Module grid test" });
    expect(grid.page).toBe("grid");
    expect(at(grid.frame, 0, 0)).toBeGreaterThan(0);
    expect(at(grid.frame, 2, 2)).toBeGreaterThan(0);
    expect(at(grid.frame, 3, 3)).toBe(0);

    const checker = sceneWith({ screen: "Pixel checkerboard" });
    expect(checker.page).toBe("checkerboard");
    expect(at(checker.frame, 0, 0)).toBeGreaterThan(0);
    expect(at(checker.frame, 1, 0)).toBe(0);
  });

  it("mirrors each chip locally when flip X is on", () => {
    const normal = sceneWith({});
    const flipped = sceneWith({ flipX: true });
    expect(at(flipped.frame, 0, 1)).toBe(at(normal.frame, 7, 1));
    expect(lit(flipped.frame)).toBe(lit(normal.frame));
  });

  it("keeps the panel dark when the display is powered off", () => {
    const scene = sceneWith({ displayPower: false });
    expect(lit(scene.frame)).toBe(0);
    expect(scene.summary).toContain("Display power is off");
  });

  it("dims the preview inside the night window", () => {
    const day = sceneWith({ nightDim: true, nightStart: 22, nightEnd: 6 }, new Date(2026, 0, 2, 12, 0, 0));
    const night = sceneWith({ nightDim: true, nightStart: 22, nightEnd: 6, brightness: 12, nightBrightness: 1 }, new Date(2026, 0, 2, 23, 0, 0));
    expect(day.nightNow).toBe(false);
    expect(night.nightNow).toBe(true);
    expect(night.effectiveBrightness).toBe(1);
  });

  it("treats equal night hours like the firmware: an all-day night window", () => {
    const noon = sceneWith({ nightDim: true, nightStart: 22, nightEnd: 22, nightBrightness: 2 }, new Date(2026, 0, 2, 12, 0, 0));
    expect(noon.nightNow).toBe(true);
    expect(noon.effectiveBrightness).toBe(2);
  });

  it("leaves retained screen cycling to the stateful timeline, not elapsed-slot rendering", () => {
    const start = new Date(2026, 0, 2, 12, 0, 0).getTime();
    const cfg = { ...DEFAULT_CONFIG, autoCycle: true, cycleInterval: 5 };
    expect(renderScene(cfg, new Date(start), start, undefined, 1_000).page).toBe("clock");
    expect(renderScene(cfg, new Date(start + 35_000), start, undefined, 36_000).page).toBe("clock");
    expect(renderScene({ ...cfg, screen: "Date" }, new Date(start), start, undefined, 1_000).page).toBe("date");
    expect(renderScene({ ...cfg, screen: "Pixel checkerboard" }, new Date(start), start, undefined, 1_000).page).toBe("checkerboard");
  });

  it("uses real message timing even with frozen or timezone-shifted display time", () => {
    const cfg = { ...DEFAULT_CONFIG, message: "HI", messageHold: 15 };
    expect(renderScene(cfg, new Date(2026, 0, 2, 0), 1000, undefined, 14000).messageActive).toBe(true);
    expect(renderScene(cfg, new Date(2026, 0, 2, 0), 1000, undefined, 16000).messageActive).toBe(false);
  });

});
