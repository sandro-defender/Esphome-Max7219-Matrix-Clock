import { beforeAll, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { FIRMWARE, firmwareOption } from "./firmware";
import { PreviewTimeline, type TimelineFrame } from "./previewTimeline";
import { renderScene } from "./render";
import { DEFAULT_CONFIG, type Config } from "./types";
import { SETTLED } from "./digitAnimation";
import { monotonicNow } from "./usePreview";

const root = fileURLToPath(new URL("../../", import.meta.url));
const binary = `${root}tests/renderer_fixture`;
const civil = new Date(2026, 9, 1, 12, 34, 56);
// Timeline tests assert state progression, not the separately tested visual
// animations. Keeping the native and browser render paths settled isolates the
// timer contract from the screen-slide pixels.
const config = (values: Partial<Config>): Config => ({
  ...DEFAULT_CONFIG,
  digitAnimation: false,
  dateScreenDuration: 5,
  ...values,
});
beforeAll(() => { execFileSync("make", ["-C", "tests", "fixture"], { cwd: root, stdio: "pipe" }); });

type Step = { at: number; changes?: Partial<Config> };
type NativeFrame = {
  pixels: string;
  brightness: number;
  mode: string;
  frameScreen: string;
  screenAfter: string;
  screenChanged: boolean;
  screenChange: string;
  messageActive: boolean;
  messageVisible: boolean;
  messageDeadline: number;
  cycleLast: number;
  lastTick: number;
};

function nativeSequence(initial: Config, steps: Step[]): NativeFrame[] {
  const geo = { width: Math.max(1, Math.round(initial.chips)) * 8, height: 8 };
  const font = FIRMWARE.fonts.find((item) => item.id === initial.clockFont)!;
  const values: Record<string, string | number> = Object.fromEntries(FIRMWARE.settings.map((item) => [
    item.key,
    typeof initial[item.key] === "string"
      ? firmwareOption(item.key, String(initial[item.key]))
      : String(initial[item.key]),
  ]));
  Object.assign(values, {
    width: geo.width,
    height: geo.height,
    font: font.firmwareId ?? "compact",
    hour: civil.getHours(),
    minute: civil.getMinutes(),
    second: civil.getSeconds(),
    day: civil.getDate(),
    month: civil.getMonth() + 1,
    message: initial.message,
    steps: steps.length,
  });
  steps.forEach(({ at, changes = {} }, index) => {
    values[`step${index}.nowMs`] = at;
    for (const setting of FIRMWARE.settings) {
      const value = changes[setting.key];
      if (value === undefined) continue;
      values[`step${index}.${setting.key}`] = typeof value === "string"
        ? firmwareOption(setting.key, value)
        : String(value);
    }
    if (changes.message !== undefined) values[`step${index}.message`] = changes.message;
    if (changes.messageHold !== undefined) values[`step${index}.messageHold`] = changes.messageHold;
  });
  const result = JSON.parse(execFileSync(binary, Object.entries(values).map(([key, value]) => `${key}=${value}`), {
    encoding: "utf8",
    maxBuffer: 2 * 1024 * 1024,
  })) as { frames: NativeFrame[] };
  return result.frames;
}

function visible(scene: ReturnType<typeof renderScene>, cfg: Config): string {
  return [...scene.frame.pixels].map((pixel) => !cfg.displayPower ? 0 : cfg.invert ? 1 - pixel : pixel).join("");
}

function assertNativeParity(initial: Config, steps: Step[]): NativeFrame[] {
  const native = nativeSequence(initial, steps);
  const timeline = new PreviewTimeline();
  let cfg = initial;
  steps.forEach(({ at, changes = {} }, index) => {
    cfg = { ...cfg, ...changes };
    const state: TimelineFrame = timeline.update(cfg, at);
    const scene = renderScene(cfg, civil, 0, SETTLED, state.nowMs, state);
    const cpp = native[index];
    expect(state.screen, `frame ${index} screen before Report feedback`).toBe(cpp.frameScreen);
    expect(state.selectedAfterReport, `frame ${index} selected screen after Report feedback`).toBe(cpp.screenAfter);
    expect(state.screenChanged, `frame ${index} Report.screen_changed`).toBe(cpp.screenChanged);
    expect(scene.page, `frame ${index} page`).toBe(cpp.mode.toLowerCase().replace(" ", ""));
    expect(visible(scene, cfg), `frame ${index} visible pixels`).toBe(cpp.pixels);
    expect(scene.effectiveBrightness, `frame ${index} brightness`).toBe(cpp.brightness);
    expect(state.runtimeMessageActive, `frame ${index} queued message state`).toBe(cpp.messageActive);
    expect(state.messageActive, `frame ${index} visible message state`).toBe(cpp.messageVisible);
    expect(state.messageDeadlineMs, `frame ${index} message deadline`).toBe(cpp.messageDeadline);
    expect(state.cycleLastMs, `frame ${index} cycle timer`).toBe(cpp.cycleLast);
    expect(state.lastTickMs, `frame ${index} housekeeping timer`).toBe(cpp.lastTick);
  });
  return native;
}

describe("stateful preview follows retained native Runtime", () => {
  it("toggles once after delayed frames and applies Report.screen_changed to the next frame", () => {
    const cfg = config({ autoCycle: true, cycleInterval: 5, secondsMode: "Off", blinkColon: false });
    const native = assertNativeParity(cfg, [
      { at: 1_000 },
      { at: 2_000 },
      { at: 3_000 },
      { at: 35_000 },
      { at: 35_001 },
      { at: 40_000 },
      { at: 40_001 },
    ]);
    expect(native[3]).toMatchObject({ frameScreen: "Clock", screenChange: "Date", screenAfter: "Date" });
    expect(native[4]).toMatchObject({ frameScreen: "Date", mode: "Date" });
    expect(native[5]).toMatchObject({ frameScreen: "Date", screenChange: "Clock", screenAfter: "Clock" });
  });

  it("hides an expired message before housekeeping, retains its queue, then clears and resumes one overdue cycle", () => {
    const cfg = config({ autoCycle: true, cycleInterval: 5, secondsMode: "Off", blinkColon: false });
    const native = assertNativeParity(cfg, [
      { at: 1_000 },
      { at: 2_000 },
      { at: 2_100, changes: { message: "TEA READY", messageHold: 3 } },
      { at: 3_000 },
      { at: 4_000 },
      { at: 5_000 },
      { at: 5_100 },
      { at: 6_000 },
      { at: 6_001 },
    ]);
    expect(native[6]).toMatchObject({ messageActive: true, messageVisible: false, messageDeadline: 5_100, screenChanged: false });
    expect(native[7]).toMatchObject({ messageActive: false, messageVisible: false, frameScreen: "Clock", screenChange: "Date", screenAfter: "Date" });
    expect(native[8]).toMatchObject({ mode: "Date", frameScreen: "Date" });
  });

  it("interrupts a message on a user screen change without restarting the retained cycle timer", () => {
    const cfg = config({ autoCycle: true, cycleInterval: 10, secondsMode: "Off", blinkColon: false });
    const native = assertNativeParity(cfg, [
      { at: 1_000 },
      { at: 2_000 },
      { at: 2_100, changes: { message: "DOOR OPEN", messageHold: 30 } },
      { at: 3_000 },
      { at: 3_300, changes: { screen: "Date" } },
      { at: 4_000 },
      { at: 11_000 },
      { at: 11_001 },
    ]);
    expect(native[4]).toMatchObject({ messageActive: false, mode: "Date", frameScreen: "Date" });
    expect(native[6]).toMatchObject({ frameScreen: "Date", screenChange: "Clock", screenAfter: "Clock" });
  });

  it("keeps cycle bookkeeping through preference edits and follows one-second auto-cycle resets", () => {
    const cfg = config({ autoCycle: true, cycleInterval: 10, secondsMode: "Off", blinkColon: false });
    const native = assertNativeParity(cfg, [
      { at: 1_000 },
      { at: 2_000 },
      { at: 3_000 },
      { at: 3_500, changes: { cycleInterval: 5 } },
      { at: 4_000, changes: { brightness: 7 } },
      { at: 6_000 },
      { at: 6_001 },
      { at: 6_500, changes: { autoCycle: false } },
      { at: 7_000 },
      { at: 7_100, changes: { autoCycle: true } },
      { at: 8_000 },
      { at: 13_000 },
    ]);
    expect(native[5]).toMatchObject({ screenChange: "Date", cycleLast: 6_000 });
    expect(native[4].brightness).toBe(7);
    expect(native[8].cycleLast).toBe(0);
    expect(native[10].cycleLast).toBe(8_000);
    expect(native[11]).toMatchObject({ screenChange: "Clock", cycleLast: 13_000 });
  });

  it("uses uint32 millis arithmetic for housekeeping, message deadlines and cycling across rollover", () => {
    const cfg = config({ autoCycle: true, cycleInterval: 5, secondsMode: "Off", blinkColon: false });
    const start = 0xffff_ff00;
    const native = assertNativeParity(cfg, [
      { at: start },
      { at: (start + 1_000) >>> 0, changes: { message: "ROLLOVER", messageHold: 3 } },
      { at: (start + 2_000) >>> 0 },
      { at: (start + 3_100) >>> 0 },
      { at: (start + 5_000) >>> 0 },
      { at: (start + 5_001) >>> 0 },
    ]);
    expect(native[3]).toMatchObject({ messageActive: true, messageVisible: true, screenChanged: false });
    expect(native[4]).toMatchObject({ messageActive: false, frameScreen: "Clock", screenChanged: true, screenChange: "Date" });
    expect(native[5]).toMatchObject({ frameScreen: "Date", mode: "Date" });
  });

  it("does not re-arm an existing firmware message when only its default-duration preference changes", () => {
    const cfg = config({ autoCycle: false, message: "PERSIST", messageHold: 5, secondsMode: "Off" });
    const native = assertNativeParity(cfg, [
      { at: 1_000 },
      { at: 2_000, changes: { messageHold: 1 } },
      { at: 5_999 },
      { at: 6_000 },
      { at: 6_999 },
    ]);
    expect(native[0].messageDeadline).toBe(6_000);
    expect(native[2]).toMatchObject({ messageActive: true, messageVisible: true, messageDeadline: 6_000 });
    expect(native[3]).toMatchObject({ messageActive: true, messageVisible: false, messageDeadline: 6_000 });
    expect(native[4]).toMatchObject({ messageActive: false, messageVisible: false, messageDeadline: 0 });
  });

  it("is idempotent when settled and animated draw paths consume the same logical frame", () => {
    const cfg = config({ autoCycle: true, cycleInterval: 5, secondsMode: "Off" });
    const timeline = new PreviewTimeline();
    const first = timeline.update(cfg, 1_000);
    const repeated = timeline.update(cfg, 1_000);
    expect(repeated).toEqual(first);
    const late = timeline.update(cfg, 20_000);
    expect(late.screenChanged).toBe(true);
    expect(late.selectedAfterReport).toBe("Date");
    expect(timeline.update(cfg, 20_000)).toEqual(late);
  });

  it("samples runtime from performance.now rather than wall-clock Date.now", () => {
    const performanceClock = vi.spyOn(performance, "now").mockReturnValue(4_321.5);
    const wallClock = vi.spyOn(Date, "now").mockImplementation(() => { throw new Error("wall clock used for runtime"); });
    try {
      expect(monotonicNow()).toBe(4_321.5);
    } finally {
      wallClock.mockRestore();
      performanceClock.mockRestore();
    }
  });

  it("keeps unsupported countdown, alert, boot and OTA runtime timelines out of the verified contract", () => {
    expect(PreviewTimeline.pendingModes).toEqual(["countdown", "alert", "boot", "ota"]);
  });
});
