import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DigitSlide, useDigitSlide, useReducedMotion, type SlideOptions } from "./digitAnimation";
import { clockContent, dateContent, renderScene, type Scene } from "./render";
import type { Config } from "./types";

/** "HH:MM[:SS]" freezes the preview; an empty value follows the real clock. */
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

/** Convert browser clock to the firmware timezone, including DST. */
export function dateInZone(date: Date, timezone: string): Date {
  try {
    const values = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(date).map((part) => [part.type, part.value]));
    return new Date(Number(values.year), Number(values.month)-1, Number(values.day), Number(values.hour), Number(values.minute), Number(values.second), date.getMilliseconds());
  } catch { return date; }
}

export function usePreviewClock(previewTime: string, timezone: string, intervalMs: number): Date {
  const [tick, setTick] = useState(() => new Date());
  useEffect(() => {
    // Even frozen digits need a live monotonic source for marquee/timeout.
    const id = window.setInterval(() => setTick(new Date()), Math.max(1, intervalMs));
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return useMemo(() => previewDate(previewTime, dateInZone(tick, timezone)), [previewTime, timezone, tick]);
}

/**
 * When the composed message last changed. The marquee offset and the message
 * hold both measure from it, exactly like the firmware's `message_started_ms`.
 */
export function useMessageStamp(message: string): number {
  const stamp = useRef(Date.now());
  const previous = useRef(message);
  if (previous.current !== message) {
    previous.current = message;
    stamp.current = Date.now();
  }
  return stamp.current;
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
 * The whole live preview in one place: the clock source, the rendered scene and
 * the per-digit slide that the firmware's `animation_ms` controls.
 */
export function usePreview(cfg: Config): Preview {
  const now = usePreviewClock(cfg.previewTime, cfg.timezone, cfg.displayUpdateMs);
  const cycleStamp = useRef(Date.now());
  useEffect(() => { cycleStamp.current = Date.now(); }, [cfg.autoCycle, cfg.screen, cfg.cycleInterval]);
  const messageAt = useMessageStamp(cfg.message);
  const runtimeNowMs = Date.now();
  const reducedMotion = useReducedMotion();
  const settled = useMemo(() => renderScene(cfg, now, messageAt, undefined, cycleStamp.current, runtimeNowMs), [cfg, now, messageAt, runtimeNowMs]);
  const options: SlideOptions = {
    enabled: cfg.digitAnimation, durationMs: cfg.animationMs, reducedMotion,
    layoutKey: `${settled.usedFallback ? "compact" : cfg.clockFont}:${settled.geometry.width}:${settled.geometry.height}:${cfg.alignment}`,
  };

  const { frame, replay: startSlide } = useDigitSlide(settled.content, settled.page, settled.slide + cfg.animationRowGap, options);
  const scene = useMemo(
    () => (frame.from === null ? settled : renderScene(cfg, now, messageAt, frame, cycleStamp.current, runtimeNowMs)),
    [cfg, frame, messageAt, now, settled, runtimeNowMs],
  );

  const replay = useCallback(() => {
    if (settled.content.length === 0) return;
    startSlide(earlierContent(cfg, now, settled));
  }, [cfg, now, settled, startSlide]);

  return { now, scene, sliding: frame.from !== null, reducedMotion, replay };
}

export type { DigitSlide };
