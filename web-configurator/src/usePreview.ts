import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DigitSlide, useDigitSlide, useReducedMotion, type SlideOptions } from "./digitAnimation";
import { clockContent, dateContent, renderScene, type Scene } from "./render";
import { PreviewTimeline } from "./previewTimeline";
import type { Config } from "./types";

/** "HH:MM[:SS]" freezes the preview; an empty value follows civil time. */
export function previewDate(value: string, fallback: Date): Date {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!match) return fallback;
  const date = new Date(fallback);
  const hours = Math.min(23, Math.max(0, Number(match[1])));
  const minutes = Math.min(59, Math.max(0, Number(match[2])));
  const seconds = Math.min(59, Math.max(0, Number(match[3] ?? 0)));
  date.setHours(hours, minutes, seconds, 0);
  return date;
}

/** Convert browser civil time to the firmware timezone, including DST. */
export function dateInZone(date: Date, timezone: string): Date {
  try {
    const values = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(date).map((part) => [part.type, part.value]));
    return new Date(Number(values.year), Number(values.month)-1, Number(values.day), Number(values.hour), Number(values.minute), Number(values.second), date.getMilliseconds());
  } catch { return date; }
}

/** Runtime state uses performance time, never civil Date.now() or DST edits. */
export function monotonicNow(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : 0;
}

export interface PreviewClock {
  /** Civil time for clock/date/night-schedule rendering. */
  now: Date;
  /** Monotonic runtime milliseconds, later reduced to firmware uint32 millis. */
  runtimeMs: number;
}

export function usePreviewClock(previewTime: string, timezone: string, intervalMs: number): PreviewClock {
  const [tick, setTick] = useState(() => ({ wall: new Date(), runtimeMs: monotonicNow() }));
  useEffect(() => {
    // Civil time supplies digits/timezone; performance.now supplies only
    // runtime deadlines, cycle timers, animation/alarm phases and message age.
    const id = window.setInterval(() => setTick({ wall: new Date(), runtimeMs: monotonicNow() }), Math.max(1, intervalMs));
    return () => window.clearInterval(id);
  }, [intervalMs]);
  const now = useMemo(() => previewDate(previewTime, dateInZone(tick.wall, timezone)), [previewTime, timezone, tick.wall]);
  return useMemo(() => ({ now, runtimeMs: tick.runtimeMs }), [now, tick.runtimeMs]);
}

/** The content the panel showed a second ago — the "replay slide" starting point. */
export function earlierContent(cfg: Config, now: Date, scene: Scene): string {
  const before = new Date(now.getTime() - 1000);
  if (scene.page === "date") return dateContent(new Date(now.getTime() - 86_400_000), cfg);
  return clockContent(before, cfg, scene.withSeconds);
}

export interface Preview {
  now: Date;
  scene: Scene;
  /** True while a per-digit slide is in flight. */
  sliding: boolean;
  /** `prefers-reduced-motion: reduce` — the preview never slides. */
  reducedMotion: boolean;
  /** Demonstrates the slide once, from the previous second's digits. */
  replay: () => void;
}

/**
 * The whole live preview in one place: civil time, one retained runtime frame,
 * the rendered scene and the per-digit slide controlled by firmware settings.
 */
export function usePreview(cfg: Config): Preview {
  const clock = usePreviewClock(cfg.previewTime, cfg.timezone, cfg.displayUpdateMs);
  const timelineRef = useRef<PreviewTimeline | null>(null);
  if (timelineRef.current === null) timelineRef.current = new PreviewTimeline();
  const timeline = timelineRef.current;
  // Advance exactly once for this sampled time/configuration. Both the settled
  // base scene and any animated redraw below consume this immutable snapshot.
  const runtimeFrame = useMemo(() => timeline.update(cfg, clock.runtimeMs), [timeline, cfg, clock.runtimeMs]);
  const reducedMotion = useReducedMotion();
  const settled = useMemo(
    () => renderScene(cfg, clock.now, 0, undefined, runtimeFrame.nowMs, runtimeFrame),
    [cfg, clock.now, runtimeFrame],
  );
  const options: SlideOptions = {
    enabled: cfg.digitAnimation,
    durationMs: cfg.animationMs,
    reducedMotion,
    layoutKey: `${settled.usedFallback ? "compact" : cfg.clockFont}:${settled.geometry.width}:${settled.geometry.height}:${cfg.alignment}`,
  };

  const { frame, replay: startSlide } = useDigitSlide(settled.content, settled.page, settled.slide + cfg.animationRowGap, options);
  const scene = useMemo(
    () => frame.from === null
      ? settled
      : renderScene(cfg, clock.now, 0, frame, runtimeFrame.nowMs, runtimeFrame),
    [cfg, clock.now, frame, runtimeFrame, settled],
  );

  const replay = useCallback(() => {
    if (settled.content.length === 0) return;
    startSlide(earlierContent(cfg, clock.now, settled));
  }, [cfg, clock.now, settled, startSlide]);

  return { now: clock.now, scene, sliding: frame.from !== null, reducedMotion, replay };
}

export type { DigitSlide };
