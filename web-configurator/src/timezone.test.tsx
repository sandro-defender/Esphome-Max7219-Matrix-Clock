// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FIRMWARE } from "./firmware";
import { geometry } from "./render";
import { TuneSection } from "./Settings";
import { decodeConfig, encodeConfig, loadConfig, sanitizeConfig, saveConfig } from "./storage";
import { detectTimezone, withDetectedTimezone } from "./timezone";
import { DEFAULT_CONFIG, type Config } from "./types";
import { TIMEZONE_RECHECK_MS, useAutomaticTimezone } from "./useAutomaticTimezone";
import { dateInZone } from "./usePreview";
import { buildYaml, sanitizeTimezone } from "./yaml";

const FIRMWARE_DEFAULT = String(FIRMWARE.defaults.timezone);
let browserZone = "Asia/Tbilisi";
let current: Config;
let root: Root | undefined;
let container: HTMLDivElement;

function Harness({ initial = DEFAULT_CONFIG }: { initial?: Config }) {
  const [cfg, setCfg] = useState(() => withDetectedTimezone(initial));
  const detected = useAutomaticTimezone(setCfg);
  current = cfg;
  return <>
    <TuneSection cfg={cfg} detected={detected} geo={geometry(cfg.chips, cfg.rows)} patch={(key, value) => setCfg((before) => {
      const next = { ...before, [key]: value };
      return key === "automaticTimezone" && value === true ? withDetectedTimezone(next) : next;
    })} />
    <button onClick={() => setCfg(withDetectedTimezone(sanitizeConfig(null)))}>Reset settings</button>
  </>;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "setTimeout", "clearTimeout"] });
  browserZone = "Asia/Tbilisi";
  const resolve = Intl.DateTimeFormat.prototype.resolvedOptions;
  vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockImplementation(function (this: Intl.DateTimeFormat) {
    return { ...resolve.call(this), timeZone: browserZone };
  });
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  localStorage.clear();
  window.history.replaceState(null, "", "/");
  container = document.createElement("div");
  document.body.append(container);
});
afterEach(() => {
  if (root) act(() => root!.unmount());
  root = undefined;
  container.remove();
  localStorage.clear();
  window.history.replaceState(null, "", "/");
  vi.restoreAllMocks();
  vi.useRealTimers();
});
function mount(initial?: Config) {
  root = createRoot(container);
  act(() => root!.render(<Harness initial={initial} />));
}
function toggleAutomatic() {
  act(() => container.querySelector<HTMLInputElement>('[aria-label="Automatic timezone"]')!.click());
}

describe("automatic timezone policy", () => {
  it("detects through Intl and applies on first visit without mutating firmware defaults", () => {
    expect(detectTimezone()).toBe("Asia/Tbilisi");
    expect(loadConfig().from).toBe("default");
    mount();
    expect(current.timezone).toBe("Asia/Tbilisi");
    expect(DEFAULT_CONFIG.timezone).toBe(FIRMWARE_DEFAULT);
    expect(container.textContent).not.toContain("Use my timezone");
    expect(container.querySelector<HTMLInputElement>("#setting-timezone")!.readOnly).toBe(true);
  });

  it("updates old saved and shared profiles unless automatic mode was explicitly disabled", () => {
    // Legacy profiles lack the policy flag; a saved zone alone is NOT a manual override.
    const legacy = { timezone: "America/New_York", brightness: 8 };
    localStorage.setItem("max7219-clock.config.v1", JSON.stringify(legacy));
    expect(loadConfig().from).toBe("saved");
    expect(withDetectedTimezone(loadConfig().config).timezone).toBe("Asia/Tbilisi");
    const link = btoa(JSON.stringify(legacy));
    window.history.replaceState(null, "", `/#cfg=${link}`);
    expect(loadConfig().from).toBe("link");
    expect(withDetectedTimezone(loadConfig().config).timezone).toBe("Asia/Tbilisi");
    const manual = sanitizeConfig({ ...legacy, automaticTimezone: false });
    const decoded = decodeConfig(encodeConfig(manual))!;
    expect(decoded.automaticTimezone).toBe(false);
    expect(withDetectedTimezone(decoded).timezone).toBe("America/New_York");
    saveConfig(manual);
    window.history.replaceState(null, "", "/");
    expect(withDetectedTimezone(loadConfig().config).timezone).toBe("America/New_York");
    expect(sanitizeConfig({ automaticTimezone: "false" }).automaticTimezone).toBe(true);
  });

  it("refreshes on focus, visible tab return, pageshow and a periodic check", () => {
    mount();
    browserZone = "America/New_York";
    act(() => window.dispatchEvent(new Event("focus")));
    expect(current.timezone).toBe(browserZone);
    browserZone = "Australia/Sydney";
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(current.timezone).toBe("America/New_York");
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(current.timezone).toBe(browserZone);
    browserZone = "Pacific/Auckland";
    act(() => window.dispatchEvent(new Event("pageshow")));
    expect(current.timezone).toBe(browserZone);
    browserZone = "UTC";
    act(() => vi.advanceTimersByTime(TIMEZONE_RECHECK_MS));
    expect(current.timezone).toBe(browserZone);
    expect(container.textContent).toContain("Browser: UTC");
  });

  it("keeps a manual override on return and immediately detects again when re-enabled or reset", () => {
    mount(sanitizeConfig({ automaticTimezone: false, timezone: "America/New_York" }));
    expect(container.querySelector<HTMLInputElement>("#setting-timezone")!.readOnly).toBe(false);
    browserZone = "Australia/Sydney";
    act(() => window.dispatchEvent(new Event("focus")));
    act(() => vi.advanceTimersByTime(TIMEZONE_RECHECK_MS));
    expect(current.timezone).toBe("America/New_York");
    toggleAutomatic();
    expect(current.timezone).toBe("Australia/Sydney");
    toggleAutomatic();
    browserZone = "UTC";
    act(() => window.dispatchEvent(new Event("focus")));
    expect(current.timezone).toBe("Australia/Sydney");
    act(() => [...container.querySelectorAll("button")].find((button) => button.textContent === "Reset settings")!.click());
    expect(current.timezone).toBe("UTC");
    expect(current.automaticTimezone).toBe(true);
  });

  it("retains the current zone on unavailable or invalid detection and recovers later", () => {
    for (const value of [undefined, "", "Not/AZone", "Europe/Berlin; invalid"]) expect(detectTimezone(() => value)).toBeNull();
    expect(detectTimezone(() => { throw new Error("Intl unavailable"); })).toBeNull();
    expect(withDetectedTimezone(DEFAULT_CONFIG, null)).toBe(DEFAULT_CONFIG);
    browserZone = "Not/AZone";
    mount();
    expect(current.timezone).toBe(FIRMWARE_DEFAULT);
    expect(container.textContent).toContain("Detection unavailable");
    browserZone = "Asia/Tbilisi";
    act(() => window.dispatchEvent(new Event("focus")));
    const good = current;
    browserZone = "";
    act(() => window.dispatchEvent(new Event("focus")));
    expect(current).toBe(good);
  });

  it("uses the exact detected zone for YAML and preview, including date rollover", () => {
    const cfg = withDetectedTimezone(DEFAULT_CONFIG);
    expect(buildYaml(cfg, FIRMWARE.releaseVersion)).toContain('timezone: "Asia/Tbilisi"');
    const local = dateInZone(new Date("2026-10-02T22:30:00Z"), cfg.timezone);
    expect([local.getDate(), local.getHours(), local.getMinutes()]).toEqual([3, 2, 30]);
    expect(sanitizeTimezone("Asia/Tbilisi")).toBe("Asia/Tbilisi");
    expect(() => buildYaml({ ...cfg, timezone: "Not/AZone" }, FIRMWARE.releaseVersion)).toThrow(/timezone/);
    const markup = renderToStaticMarkup(<TuneSection cfg={cfg} detected="Asia/Tbilisi" patch={() => {}} geo={geometry(cfg.chips, cfg.rows)} />);
    expect(markup).toContain('for="setting-timezone"');
    expect(markup).toContain('aria-describedby="timezone-hint"');
    expect(markup).not.toContain("Use my timezone");
  });

  it("removes listeners and timers on unmount (including StrictMode remounts)", () => {
    mount();
    expect(vi.getTimerCount()).toBe(1);
    act(() => root!.unmount());
    root = undefined;
    const last = current;
    expect(vi.getTimerCount()).toBe(0);
    browserZone = "UTC";
    act(() => {
      window.dispatchEvent(new Event("focus"));
      window.dispatchEvent(new Event("pageshow"));
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(current).toBe(last);
  });
});
