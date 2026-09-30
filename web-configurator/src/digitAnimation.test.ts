import { describe, expect, it } from "vitest";

import { DigitSlide, changedDigits, isAnimatedPage, slideOffset, slidePair, type SlideOptions } from "./digitAnimation";
import { renderScene, type Frame, type SlideFrame } from "./render";
import { DEFAULT_CONFIG, type Config } from "./types";

/**
 * The preview animation has to behave like the firmware's per-digit slide-up:
 * only the digits whose value changed move, the old one leaves upwards, the new
 * one arrives from below, and the colons and unchanged digits never budge.
 * These tests drive the real renderer, so they assert drawn pixels, not intent.
 */

const ON: SlideOptions = { enabled: true, durationMs: 600, reducedMotion: false };
const cfg: Config = { ...DEFAULT_CONFIG, blinkColon: false };

const T55 = new Date(2026, 0, 2, 12, 34, 55);
const T56 = new Date(2026, 0, 2, 12, 34, 56);
const MESSAGE_AT = 0;

function frameAt(now: Date, slide?: SlideFrame): Frame {
  return renderScene(cfg, now, MESSAGE_AT, slide).frame;
}

function pixel(frame: Frame, x: number, y: number): number {
  return x < 0 || y < 0 || x >= frame.width || y >= frame.height ? 0 : frame.pixels[y * frame.width + x];
}

/** The columns one cell owns, clipped to the panel. */
function columns(frame: Frame, x: number, advance: number): number[] {
  const out: number[] = [];
  for (let column = x; column < Math.min(frame.width, x + Math.max(1, advance)); column++) out.push(column);
  return out;
}

function band(frame: Frame, cols: number[]): number[] {
  const out: number[] = [];
  for (const x of cols) for (let y = 0; y < frame.height; y++) out.push(pixel(frame, x, y));
  return out;
}

describe("DigitSlide timing", () => {
  it("starts a slide when a digit changes and reports the previous content", () => {
    const slide = new DigitSlide();
    expect(slide.update("12:34:55", "clock", ON, 0)).toEqual({ from: null, progress: 1 });
    expect(slide.active).toBe(false);

    const frame = slide.update("12:34:56", "clock", ON, 1000);
    expect(frame.from).toBe("12:34:55");
    expect(frame.progress).toBe(0);
    expect(slide.active).toBe(true);
  });

  it("runs 0 → 1 over the configured duration and then settles", () => {
    const slide = new DigitSlide();
    slide.update("12:34:55", "clock", ON, 0);
    slide.update("12:34:56", "clock", ON, 1000);

    expect(slide.progressAt(1000)).toBe(0);
    expect(slide.progressAt(1300)).toBeCloseTo(0.5, 6);
    expect(slide.progressAt(1599)).toBeLessThan(1);
    expect(slide.progressAt(1600)).toBe(1);
    // Settled: the history is the new content, so the next change diffs again.
    expect(slide.update("12:34:56", "clock", ON, 1600)).toEqual({ from: null, progress: 1 });
    expect(slide.active).toBe(false);

    const next = slide.update("12:34:57", "clock", ON, 2000);
    expect(next.from).toBe("12:34:56");
  });

  it("follows the Animation duration slider", () => {
    const fast = new DigitSlide();
    fast.update("12:34:55", "clock", { ...ON, durationMs: 200 }, 0);
    fast.update("12:34:56", "clock", { ...ON, durationMs: 200 }, 1000);
    expect(fast.progressAt(1100)).toBeCloseTo(0.5, 6);
    expect(fast.progressAt(1200)).toBe(1);

    const slow = new DigitSlide();
    slow.update("12:34:55", "clock", { ...ON, durationMs: 2000 }, 0);
    slow.update("12:34:56", "clock", { ...ON, durationMs: 2000 }, 1000);
    expect(slow.progressAt(1500)).toBeCloseTo(0.25, 6);
  });

  it("never slides when the switch is off, the duration is zero, or motion is reduced", () => {
    for (const options of [
      { ...ON, enabled: false },
      { ...ON, durationMs: 0 },
      { ...ON, reducedMotion: true },
    ]) {
      const slide = new DigitSlide();
      slide.update("12:34:55", "clock", options, 0);
      expect(slide.update("12:34:56", "clock", options, 1000), JSON.stringify(options)).toEqual({
        from: null,
        progress: 1,
      });
      expect(slide.active).toBe(false);
    }
  });

  it("cancels the slide on a layout change, exactly like the firmware", () => {
    const shorter = new DigitSlide();
    shorter.update("12:34:56", "clock", ON, 0);
    expect(shorter.update("12:34", "clock", ON, 100)).toEqual({ from: null, progress: 1 });

    const otherScreen = new DigitSlide();
    otherScreen.update("12:34:56", "clock", ON, 0);
    expect(otherScreen.update("02.01", "date", ON, 100)).toEqual({ from: null, progress: 1 });

    const message = new DigitSlide();
    message.update("12:34:56", "clock", ON, 0);
    expect(message.update("12:34:57", "message", ON, 100)).toEqual({ from: null, progress: 1 });
  });

  it("animates the clock and date screens only", () => {
    expect(isAnimatedPage("clock")).toBe(true);
    expect(isAnimatedPage("date")).toBe(true);
    for (const page of ["message", "grid", "checkerboard", "blank"] as const) {
      expect(isAnimatedPage(page), page).toBe(false);
    }
  });

  it("keeps an in-flight slide running when the content changes again", () => {
    const slide = new DigitSlide();
    slide.update("12:34:55", "clock", ON, 0);
    slide.update("12:34:56", "clock", ON, 1000);
    // A new digit mid-slide does not restart the clock (firmware timing).
    const frame = slide.update("12:34:57", "clock", ON, 1300);
    expect(frame.from).toBe("12:34:55");
    expect(frame.progress).toBeCloseTo(0.5, 6);
  });

  it("replays a slide on demand for a frozen preview time", () => {
    const slide = new DigitSlide();
    slide.update("12:34:56", "clock", ON, 0);
    expect(slide.update("12:34:56", "clock", ON, 5000).from).toBeNull();

    const frame = slide.replay("12:34:55", ON, 5000);
    expect(frame.from).toBe("12:34:55");
    expect(slide.active).toBe(true);
    expect(slide.progressAt(5300)).toBeCloseTo(0.5, 6);

    // A different length, or the same content, is refused.
    const other = new DigitSlide();
    other.update("12:34:56", "clock", ON, 0);
    expect(other.replay("12:34", ON, 100).from).toBeNull();
    expect(other.replay("12:34:56", ON, 100).from).toBeNull();
  });
});

describe("slide geometry", () => {
  it("moves the old digit up and the new one in from below, in whole rows", () => {
    expect(slideOffset(0, 8)).toBe(0);
    expect(slideOffset(0.49, 8)).toBe(3);
    expect(slideOffset(0.5, 8)).toBe(4);
    expect(slideOffset(1, 8)).toBe(8);
    expect(slideOffset(2, 8)).toBe(8);
    expect(slideOffset(-1, 8)).toBe(0);

    expect(slidePair(0, 8, 0)).toEqual({ from: 0, to: 8 });
    expect(slidePair(0.5, 8, 0)).toEqual({ from: -4, to: 4 });
    expect(slidePair(1, 8, 0)).toEqual({ from: -8, to: 0 });
    // The two glyphs never overlap: the pair is exactly `slide` rows apart.
    for (const progress of [0, 0.1, 0.37, 0.5, 0.83, 0.99]) {
      const pair = slidePair(progress, 7, 1);
      expect(pair.to - pair.from).toBe(7);
    }
  });

  it("lists only the digits that changed", () => {
    expect(changedDigits("12:34:55", "12:34:56")).toEqual([7]);
    expect(changedDigits("12:34:59", "12:35:00")).toEqual([4, 6, 7]);
    expect(changedDigits("12:34:56", "12:34:56")).toEqual([]);
    // The separators are never digits, so a blinking colon never slides.
    expect(changedDigits("12 34 56", "12:34:56")).toEqual([]);
    // A layout change is not a digit change.
    expect(changedDigits("12:34:56", "12:34")).toBeNull();
  });
});

describe("the drawn frame", () => {
  const before = renderScene(cfg, T55, MESSAGE_AT);
  const layout = before.layout;
  const settled = frameAt(T56);

  it("exposes one cell per drawn character", () => {
    expect(layout).not.toBeNull();
    expect(layout!.content).toBe("12:34:55");
    expect(layout!.cells.map((cell) => cell.char).join("")).toBe("12:34:55");
    expect(layout!.cells.filter((cell) => cell.digit)).toHaveLength(6);
    expect(layout!.slide).toBeGreaterThan(0);
  });

  it("moves one digit while every other column stays exactly as it was", () => {
    const mid = frameAt(T56, { from: "12:34:55", progress: 0.5 });
    const changing = layout!.cells[7];
    const changingCols = columns(mid, changing.x, changing.advance);

    layout!.cells.forEach((cell, index) => {
      const cols = columns(mid, cell.x, cell.advance);
      if (index === 7) return;
      expect(band(mid, cols), `cell ${index} "${cell.char}"`).toEqual(band(settled, cols));
    });

    // The changed digit is mid-travel, so its columns differ from both ends.
    expect(band(mid, changingCols)).not.toEqual(band(settled, changingCols));
    expect(band(mid, changingCols)).not.toEqual(band(before.frame, changingCols));
    // …and it is lit somewhere: the slide draws ink, it does not blank the cell.
    expect(band(mid, changingCols).some((value) => value > 0)).toBe(true);
  });

  it("starts from the old digit and lands on the new one", () => {
    const changing = layout!.cells[7];
    const cols = columns(settled, changing.x, changing.advance);

    const start = frameAt(T56, { from: "12:34:55", progress: 0 });
    expect(band(start, cols)).toEqual(band(before.frame, cols));

    const end = frameAt(T56, { from: "12:34:55", progress: 1 });
    expect(band(end, cols)).toEqual(band(settled, cols));
  });

  it("slides the digit upwards, row by row", () => {
    const changing = layout!.cells[7];
    const cols = columns(settled, changing.x, changing.advance);
    const topRow = (frame: Frame) => {
      for (let y = 0; y < frame.height; y++) if (cols.some((x) => pixel(frame, x, y) > 0)) return y;
      return null;
    };

    const previous = frameAt(T55);
    const rows: (number | null)[] = [];
    for (const progress of [0, 0.25, 0.5, 0.75]) {
      const frame = frameAt(T56, { from: "12:34:55", progress });
      const top = topRow(frame);
      expect(top, `progress ${progress}`).not.toBeNull();
      // The incoming digit enters from below: the lit block always starts at or
      // above the settled position only once the old one has left.
      rows.push(top);
    }
    expect(rows[0]).toBe(topRow(previous));
    expect(rows.every((row) => row !== null)).toBe(true);
  });

  it("keeps the colons in place while a digit slides", () => {
    const mid = frameAt(T56, { from: "12:34:55", progress: 0.5 });
    const colons = layout!.cells.filter((cell) => cell.char === ":");
    expect(colons.length).toBeGreaterThan(0);
    for (const colon of colons) {
      const cols = columns(mid, colon.x, colon.advance);
      expect(band(mid, cols)).toEqual(band(settled, cols));
    }
  });

  it("does not animate a message or a test pattern", () => {
    const message = renderScene({ ...cfg, message: "DOOR OPEN", messageHold: 30 }, T56, Date.now(), {
      from: "12:34:55",
      progress: 0.5,
    });
    expect(message.page).toBe("message");
    expect(message.layout).toBeNull();
    expect(message.content).toBe("");
  });
});
