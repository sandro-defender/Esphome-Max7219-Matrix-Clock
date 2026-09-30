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

/** The preview clock: the frozen value, or the wall clock refreshed 20x/s. */
export function usePreviewClock(previewTime: string): Date {
  const [tick, setTick] = useState(() => new Date());
  useEffect(() => {
    if (previewTime) return undefined;
    const id = window.setInterval(() => setTick(new Date()), 50);
    return () => window.clearInterval(id);
  }, [previewTime]);
  return useMemo(() => previewDate(previewTime, tick), [previewTime, tick]);
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
  if (cfg.layoutPreview === "modules") {
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${pad(before.getHours())}${pad(before.getMinutes())}${pad(before.getSeconds())}`.slice(0, 6);
  }
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
  const now = usePreviewClock(cfg.previewTime);
  const messageAt = useMessageStamp(cfg.message);
  const reducedMotion = useReducedMotion();
  const options: SlideOptions = {
    enabled: cfg.digitAnimation,
    durationMs: cfg.animationMs,
    reducedMotion,
  };

  const settled = useMemo(() => renderScene(cfg, now, messageAt), [cfg, now, messageAt]);
  const { frame, replay: startSlide } = useDigitSlide(settled.content, settled.page, settled.slide, options);
  const scene = useMemo(
    () => (frame.from === null ? settled : renderScene(cfg, now, messageAt, frame)),
    [cfg, frame, messageAt, now, settled],
  );

  const replay = useCallback(() => {
    if (settled.content.length === 0) return;
    startSlide(earlierContent(cfg, now, settled));
  }, [cfg, now, settled, startSlide]);

  return { now, scene, sliding: frame.from !== null, reducedMotion, replay };
}

export type { DigitSlide };
