import { normalizeMessage } from "./fonts";
import type { Config, ScreenMode } from "./types";

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
  /** Runtime time supplied to the native renderer, modulo uint32_t. */
  nowMs: number;
  /** Screen option used to build this frame, before any Report feedback. */
  screen: ScreenMode;
  /** Message visible in this frame; an expired-but-not-housekept message is hidden. */
  message: string;
  /** Whether the message is visible now, as checked by effective_mode(). */
  messageActive: boolean;
  /** Runtime queue bit; firmware clears it only during one-second housekeeping. */
  runtimeMessageActive: boolean;
  messageAgeMs: number;
  messageHoldLeft: number | null;
  messageDeadlineMs: number;
  /** Automatic screen-cycle report produced during this frame's housekeeping. */
  screenChanged: boolean;
  screenChange: "Clock" | "Date" | null;
  /** Current screen option after applying the report, for the next frame only. */
  selectedAfterReport: ScreenMode;
  mode: "Clock" | "Date" | "Message" | "Module grid test" | "Pixel checkerboard";
  lastTickMs: number;
  cycleLastMs: number;
}

/**
 * Stateful browser counterpart to the firmware's retained Runtime.
 *
 * `update()` advances one logical draw frame. It performs the same uint32
 * housekeeping tests, clears expired messages only on a housekeeping tick,
 * and creates at most one cycle report after a delayed frame. It captures the
 * input screen before drawing, then applies the equivalent of display.yaml's
 * Report-driven select updates for the *next* frame. Calling it twice with the
 * same frame inputs is idempotent, so settled and animated render paths cannot
 * advance the runtime twice.
 *
 * Countdown, alert, boot and OTA timelines remain intentionally unsupported;
 * their renderer pixels are covered separately, but their retained event
 * interactions are not verified here.
 */
export class PreviewTimeline {
  static readonly pendingModes = ["countdown", "alert", "boot", "ota"] as const;

  private lastTick = 0;
  private cycleLast = 0;
  private selected: ScreenMode = "Clock";
  private configuredScreen: ScreenMode | null = null;
  private configuredMessage: string | null = null;
  private messageText = "";
  private messageActive = false;
  private messageStarted = 0;
  private messageDeadline = 0;
  private holdSeconds = 0;
  private reportedMode: TimelineFrame["mode"] | null = null;
  private lastInputKey: string | null = null;
  private lastFrame: TimelineFrame | null = null;

  update(cfg: Config, time: number): TimelineFrame {
    const now = millis(time);
    const key = JSON.stringify([now, cfg.screen, cfg.message, cfg.messageHold, cfg.autoCycle, cfg.cycleInterval]);
    if (key === this.lastInputKey && this.lastFrame !== null) return this.lastFrame;

    // Screen selection is an event in firmware: selecting a normal screen
    // interrupts a queued message/alert, while selecting Message re-arms the
    // retained text (or starts the firmware's placeholder if it was cleared).
    if (this.configuredScreen === null) {
      this.configuredScreen = cfg.screen;
      this.selected = cfg.screen;
      if (cfg.screen === "Message") this.selectMessage(now);
    } else if (this.configuredScreen !== cfg.screen) {
      this.configuredScreen = cfg.screen;
      this.selected = cfg.screen;
      if (cfg.screen === "Message") this.selectMessage(now);
      else this.clearMessage();
    }

    // The composer models a show_message action. Its hold duration is sampled
    // when the message changes; editing the default-duration preference does
    // not retroactively alter an already queued firmware message.
    if (this.configuredMessage !== cfg.message) {
      this.configuredMessage = cfg.message;
      if (cfg.message.length === 0) {
        this.clearMessage();
      } else {
        const text = normalizeMessage(cfg.message);
        const seconds = Math.max(0, Math.min(3600, Math.trunc(cfg.messageHold)));
        this.setMessage(text, seconds, now);
      }
    }

    const tick = this.lastTick === 0 || elapsedMillis(now, this.lastTick) >= 1000;
    let screenChanged = false;
    let screenChange: "Clock" | "Date" | null = null;
    if (tick) {
      this.lastTick = now === 0 ? 1 : now;

      // effective_mode() hides an expired message immediately; housekeeping
      // clears Runtime's queue bit and deadline only on this one-second path.
      if (this.messageActive && this.messageDeadline !== 0 && deadlineReached(now, this.messageDeadline)) {
        this.clearMessage();
      }

      const frameScreen = displayScreen(this.selected);
      if (cfg.autoCycle && !this.messageActive && (frameScreen === "Clock" || frameScreen === "Date")) {
        const stamp = now === 0 ? 1 : now;
        const interval = Math.max(5, cfg.cycleInterval) * 1000;
        if (this.cycleLast === 0) {
          this.cycleLast = stamp;
        } else if (elapsedMillis(stamp, this.cycleLast) >= interval) {
          this.cycleLast = stamp;
          screenChanged = true;
          screenChange = frameScreen === "Clock" ? "Date" : "Clock";
        }
      } else if (!cfg.autoCycle) {
        // Firmware resets this only inside housekeeping, not when the control
        // changes and not while a message temporarily blocks screen cycling.
        this.cycleLast = 0;
      }
    }

    const frameScreen = this.selected;
    const underlyingMode = modeForScreen(displayScreen(frameScreen));
    const messageVisible = this.messageActive && !deadlineReached(now, this.messageDeadline);
    const mode = messageVisible ? "Message" : underlyingMode;
    const modeChanged = mode !== this.reportedMode;
    if (modeChanged) {
      this.reportedMode = mode;
      // This is the post-draw `Report.mode_changed` select update in the YAML
      // writer. A temporary Message mode deliberately does not replace the
      // configured screen; returning to a normal mode does.
      if (mode !== "Message") this.selected = frameScreen === "Message" ? "Clock" : frameScreen;
    }
    // Like display.yaml, a cycle report is applied after the mode report and
    // wins if both occur on the same rendered frame.
    if (screenChanged && screenChange !== null) this.selected = screenChange;

    const age = elapsedMillis(now, this.messageStarted);
    const holdLeft = this.holdSeconds === 0
      ? null
      : Math.max(0, Math.ceil((this.holdSeconds * 1000 - age) / 1000));
    const result: TimelineFrame = {
      nowMs: now,
      screen: frameScreen,
      message: messageVisible ? this.messageText : "",
      messageActive: messageVisible,
      runtimeMessageActive: this.messageActive,
      messageAgeMs: age,
      messageHoldLeft: holdLeft,
      messageDeadlineMs: this.messageDeadline,
      screenChanged,
      screenChange,
      selectedAfterReport: this.selected,
      mode,
      lastTickMs: this.lastTick,
      cycleLastMs: this.cycleLast,
    };
    this.lastInputKey = key;
    this.lastFrame = result;
    return result;
  }

  private selectMessage(now: number): void {
    if (this.messageText.length === 0) {
      this.setMessage("MAX7219 CLOCK", 0, now);
    } else {
      // This mirrors screen_mode's set_action: it reactivates retained text but
      // does not reset its deadline or scroll start.
      this.messageActive = true;
    }
  }

  private setMessage(text: string, durationSeconds: number, now: number): void {
    this.messageText = text;
    this.messageActive = true;
    this.messageStarted = now;
    this.holdSeconds = durationSeconds;
    this.messageDeadline = durationSeconds === 0 ? 0 : millis(now + durationSeconds * 1000);
  }

  private clearMessage(): void {
    this.messageText = "";
    this.messageActive = false;
    this.messageDeadline = 0;
  }
}

function displayScreen(option: ScreenMode): "Clock" | "Date" | "Module grid test" | "Pixel checkerboard" {
  // The actual writer's screen_from_option("Message") falls through to Clock.
  if (option === "Message") return "Clock";
  return option;
}

function modeForScreen(screen: ReturnType<typeof displayScreen>): TimelineFrame["mode"] {
  if (screen === "Date") return "Date";
  if (screen === "Module grid test") return "Module grid test";
  if (screen === "Pixel checkerboard") return "Pixel checkerboard";
  return "Clock";
}
