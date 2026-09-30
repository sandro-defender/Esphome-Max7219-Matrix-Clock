import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { Page } from "./render";

/**
 * Per-digit slide-up animation for the live preview.
 *
 * The rules mirror `draw_line()` in packages/max7219_clock_renderer.h:
 *
 * - only a character that is a digit in *both* the previous and the new
 *   content, and whose value changed, moves;
 * - the outgoing digit is drawn `offset` rows higher and the incoming digit
 *   `slide - offset` rows lower, with `slide = font.ink_height()`;
 * - `offset = floor(progress * slide)`, `progress` running 0 → 1 over
 *   `animation_ms` (600 ms by default, 0 disables the slide);
 * - a layout change (different screen or different content length) cancels the
 *   slide, exactly like the firmware's `same_layout` check, and separators are
 *   never digits, so the colons stay put.
 *
 * Everything here is pure timing arithmetic, so the behaviour can be asserted
 * without a canvas or a browser.
 */

/** The frame the renderer draws: previous content plus 0 → 1 progress. */
export type { SlideFrame } from "./render";
import type { SlideFrame } from "./render";

export interface SlideOptions {
  /** The "Digit slide-up animation" switch. */
  enabled: boolean;
  /** The "Animation duration" slider, in ms. 0 disables the slide. */
  durationMs: number;
  /** `prefers-reduced-motion: reduce` — never animate. */
  reducedMotion: boolean;
}

export const SETTLED: SlideFrame = { from: null, progress: 1 };

/** The firmware animates its fixed-width text screens (clock, date) only. */
export function isAnimatedPage(page: Page): boolean {
  return page === "clock" || page === "date";
}

export function isDigitChar(char: string | undefined): boolean {
  return char !== undefined && char >= "0" && char <= "9";
}

/** Indexes whose digit changed; `null` when the layout changed instead. */
export function changedDigits(previous: string, next: string): number[] | null {
  if (previous.length !== next.length) return null;
  const changed: number[] = [];
  for (let i = 0; i < next.length; i++) {
    if (isDigitChar(next[i]) && isDigitChar(previous[i]) && next[i] !== previous[i]) changed.push(i);
  }
  return changed;
}

/** Rows the outgoing digit has travelled at `progress` (the firmware `offset`). */
export function slideOffset(progress: number, slide: number): number {
  return Math.floor(Math.min(1, Math.max(0, progress)) * Math.max(0, slide));
}

/**
 * Box tops of the two digits of one changing cell: the old one leaves upwards,
 * the new one arrives from below.
 */
export function slidePair(progress: number, slide: number, boxTop: number): { from: number; to: number } {
  const offset = slideOffset(progress, slide);
  return { from: boxTop - offset, to: boxTop + slide - offset };
}

export function slideClock(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
}

/**
 * The slide state machine. One instance per preview; `update()` is called on
 * every render with the content the renderer is about to draw, which keeps the
 * slide in step with the clock instead of running a second timer.
 */
export class DigitSlide {
  private content = "";
  private page: Page = "blank";
  private from: string | null = null;
  private started = 0;
  private duration = 0;
  private running = false;

  /** True while a slide is in flight, so the caller keeps repainting. */
  get active(): boolean {
    return this.running;
  }

  /** The content the last render drew. */
  get current(): string {
    return this.content;
  }

  /** Progress at an arbitrary time, without changing the state. */
  progressAt(time: number): number {
    if (!this.running || this.duration <= 0) return 1;
    return Math.min(1, Math.max(0, (time - this.started) / this.duration));
  }

  /** Forget any slide and the captured history. */
  reset(): void {
    this.from = null;
    this.running = false;
  }

  /**
   * Restarts the slide from an explicit previous content — the "replay" control
   * uses it to demonstrate the effect on a frozen preview time.
   */
  replay(from: string, options: SlideOptions, time = slideClock()): SlideFrame {
    if (!isAnimatedPage(this.page) || !slideEnabled(options)) return SETTLED;
    if (from.length !== this.content.length || from === this.content) return SETTLED;
    this.duration = Math.max(0, options.durationMs);
    this.from = from;
    this.started = time;
    this.running = true;
    return { from, progress: this.progressAt(time) };
  }

  update(content: string, page: Page, options: SlideOptions, time = slideClock()): SlideFrame {
    const sameLayout = this.page === page && this.content.length === content.length;
    const changed = this.content !== content;
    const previous = this.content;
    this.page = page;
    this.content = content;
    this.duration = Math.max(0, options.durationMs);

    if (!isAnimatedPage(page) || !sameLayout) {
      // Screen change or a different content length: no slide (firmware
      // `same_layout`), and the history restarts from the new content.
      this.reset();
    } else if (changed && slideEnabled(options)) {
      // Keep an in-flight slide running instead of restarting it on every tick.
      if (!this.running) {
        this.started = time;
        this.from = previous;
        this.running = true;
      }
    } else if (changed) {
      this.reset();
    }

    const progress = this.progressAt(time);
    if (progress >= 1) {
      this.reset();
      return SETTLED;
    }
    return { from: this.from, progress };
  }
}

function slideEnabled(options: SlideOptions): boolean {
  return options.enabled && options.durationMs > 0 && !options.reducedMotion;
}

/** Reads `prefers-reduced-motion` once and follows live changes. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(prefersReducedMotion);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    if (typeof query.addEventListener !== "function") return undefined;
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return reduced;
}

/**
 * Drives the slide for one preview.
 *
 * The scene is rendered once per clock tick; while a slide runs, a
 * `requestAnimationFrame` loop repaints — but only when the whole-row offset
 * actually changes, because an eight-row panel cannot show sub-row positions.
 * Nothing blocks: the loop stops as soon as the slide settles.
 *
 * @param slideHeight the font's ink height, i.e. the slide distance in rows.
 */
export function useDigitSlide(
  content: string,
  page: Page,
  slideHeight: number,
  options: SlideOptions,
): { frame: SlideFrame; replay: (from: string) => void } {
  const slideRef = useRef<DigitSlide | null>(null);
  if (slideRef.current === null) slideRef.current = new DigitSlide();
  const slide = slideRef.current;
  const [, repaint] = useReducer((count: number) => count + 1, 0);
  const frame = slide.update(content, page, options);
  const active = slide.active;

  useEffect(() => {
    if (!active) return undefined;
    let queued = 0;
    let lastRow = -1;
    const step = () => {
      queued = 0;
      const progress = slide.progressAt(slideClock());
      const row = slideOffset(progress, slideHeight);
      // An eight-row panel cannot show sub-row positions, so repaint only when
      // the row offset changes: the slide stays smooth without burning frames.
      if (row !== lastRow) {
        lastRow = row;
        repaint();
      }
      if (progress < 1) queued = requestAnimationFrame(step);
    };
    queued = requestAnimationFrame(step);
    return () => {
      if (queued) cancelAnimationFrame(queued);
    };
  }, [active, slide, slideHeight]);

  const replay = useCallback(
    (from: string) => {
      if (slide.replay(from, options).from === null) return;
      repaint();
    },
    // The options are read when the click happens, not when it is bound.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [slide, options.enabled, options.durationMs, options.reducedMotion],
  );

  return { frame, replay };
}
