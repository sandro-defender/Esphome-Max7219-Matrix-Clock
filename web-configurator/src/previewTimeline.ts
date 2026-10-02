import { normalizeMessage } from "./fonts";
import type { Config } from "./types";

/** The device's uint32_t millis arithmetic, independent of wall-clock/DST edits. */
export function millis(value: number): number {
  return Math.floor(value) >>> 0;
}
export function elapsedMillis(now: number, then: number): number {
  return (millis(now) - millis(then)) >>> 0;
}
function deadlineReached(now: number, deadline: number): boolean {
  return deadline !== 0 && ((millis(now) - deadline) | 0) >= 0;
}

export interface TimelineFrame {
  /** Screen used for this frame; automatic control changes apply next frame. */
  screen: Config["screen"];
  message: string;
  messageActive: boolean;
  messageAgeMs: number;
  messageHoldLeft: number | null;
}

/**
 * Stateful twin of renderer housekeeping for the preview's normal/message
 * screens. No catch-up modulo: a late tick toggles once, just like firmware.
 * Temporary messages suspend switching, not the elapsed timer. Expiry is visible
 * immediately; clearing the runtime queue/cycling happens on the next second.
 * Countdown/alert/boot/OTA event timelines are not simulated by this class yet.
 */
export class PreviewTimeline {
  private lastTick = 0;
  private cycleLast = 0;
  private selected: Config["screen"] = "Clock";
  private configuredScreen: Config["screen"] | null = null;
  private configuredMessage: string | null = null;
  private message = "";
  private armed = false;
  private messageStarted = 0;
  private messageDeadline = 0;
  private holdSeconds = 0;

  update(cfg: Config, time: number): TimelineFrame {
    const now = millis(time);
    if (this.configuredScreen !== cfg.screen) {
      this.configuredScreen = cfg.screen;
      this.selected = cfg.screen;
    }
    if (this.configuredMessage !== cfg.message) {
      this.configuredMessage = cfg.message;
      this.message = normalizeMessage(cfg.message);
      this.armed = this.message.length > 0;
      this.messageStarted = now;
      this.holdSeconds = Math.max(0, cfg.messageHold);
      this.messageDeadline = this.holdSeconds === 0 ? 0 : millis(now + this.holdSeconds * 1000);
    }
    // Editing the preview's hold preference updates the same message deadline,
    // not its scroll origin. Once expired, a preference edit cannot resurrect it.
    if (this.armed && this.holdSeconds !== cfg.messageHold) {
      this.holdSeconds = Math.max(0, cfg.messageHold);
      this.messageDeadline = this.holdSeconds === 0 ? 0 : millis(this.messageStarted + this.holdSeconds * 1000);
    }
    const tick = this.lastTick === 0 || elapsedMillis(now, this.lastTick) >= 1000;
    if (tick) {
      this.lastTick = now === 0 ? 1 : now;
      if (this.armed && deadlineReached(now, this.messageDeadline)) {
        this.armed = false;
        this.message = "";
        this.messageDeadline = 0;
      }
    }
    const visibleMessage = this.armed && !deadlineReached(now, this.messageDeadline);
    const screen = this.selected;
    if (tick) {
      if (cfg.autoCycle && !this.armed && (screen === "Clock" || screen === "Date")) {
        const stamp = now === 0 ? 1 : now;
        const interval = Math.max(5, cfg.cycleInterval) * 1000;
        if (this.cycleLast === 0) this.cycleLast = stamp;
        else if (elapsedMillis(stamp, this.cycleLast) >= interval) {
          this.cycleLast = stamp;
          // The real writer publishes report.screen_changed after drawing.
          this.selected = screen === "Clock" ? "Date" : "Clock";
        }
      } else if (!cfg.autoCycle) this.cycleLast = 0;
    }
    const age = elapsedMillis(now, this.messageStarted);
    return {
      screen,
      message: visibleMessage ? this.message : "",
      messageActive: visibleMessage,
      messageAgeMs: age,
      messageHoldLeft: this.holdSeconds === 0 ? null : Math.max(0, Math.ceil((this.holdSeconds * 1000 - age) / 1000)),
    };
  }
}
