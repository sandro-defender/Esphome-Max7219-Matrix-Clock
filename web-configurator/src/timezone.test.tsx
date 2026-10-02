import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FIRMWARE } from "./firmware";
import { geometry } from "./render";
import { TuneSection } from "./sections";
import { loadConfig, sanitizeConfig } from "./storage";
import { detectTimezone, withDetectedTimezone } from "./timezone";
import { DEFAULT_CONFIG } from "./types";
import { buildYaml, sanitizeTimezone } from "./yaml";

const FIRMWARE_DEFAULT = String(FIRMWARE.defaults.timezone);

describe("browser timezone detection", () => {
  it("pre-fills the timezone on a first visit and keeps the firmware default elsewhere", () => {
    // A first visit is exactly `source === "default"`: no saved config, no link.
    const { config, from } = loadConfig();
    expect(from).toBe("default");
    const detected = detectTimezone(() => "Asia/Tbilisi");
    expect(detected).toBe("Asia/Tbilisi");
    const cfg = withDetectedTimezone(config, from, detected);
    expect(cfg.timezone).toBe("Asia/Tbilisi");
    // The firmware default itself is untouched: detection only affects this visit.
    expect(DEFAULT_CONFIG.timezone).toBe(FIRMWARE_DEFAULT);
  });

  it("falls back to the firmware default when detection fails or the zone is unknown", () => {
    expect(detectTimezone(() => undefined)).toBeNull();
    expect(detectTimezone(() => "")).toBeNull();
    expect(detectTimezone(() => { throw new Error("Intl unavailable"); })).toBeNull();
    expect(detectTimezone(() => "Not/AZone")).toBeNull();
    expect(detectTimezone(() => "Europe/Berlin; rm -rf /")).toBeNull();
    for (const detected of [null, detectTimezone(() => "Not/AZone")]) {
      const cfg = withDetectedTimezone(DEFAULT_CONFIG, "default", detected);
      expect(cfg.timezone).toBe(FIRMWARE_DEFAULT);
    }
  });

  it("never overwrites a saved config or a shared link", () => {
    const saved = sanitizeConfig({ ...DEFAULT_CONFIG, timezone: "America/New_York" });
    const shared = sanitizeConfig({ ...DEFAULT_CONFIG, timezone: "Australia/Sydney" });
    expect(withDetectedTimezone(saved, "saved", "Asia/Tbilisi").timezone).toBe("America/New_York");
    expect(withDetectedTimezone(shared, "link", "Asia/Tbilisi").timezone).toBe("Australia/Sydney");
    // Even a saved copy of the firmware default stays exactly as saved.
    const kept = sanitizeConfig({ ...DEFAULT_CONFIG, timezone: FIRMWARE_DEFAULT });
    expect(withDetectedTimezone(kept, "saved", "Asia/Tbilisi").timezone).toBe(FIRMWARE_DEFAULT);
  });

  it("writes the detected zone unchanged into the installer YAML", () => {
    const cfg = withDetectedTimezone(DEFAULT_CONFIG, "default", detectTimezone(() => "Asia/Tbilisi"));
    const yaml = buildYaml(cfg, FIRMWARE.releaseVersion);
    expect(yaml).toContain('timezone: "Asia/Tbilisi"');
    expect(yaml).not.toContain(FIRMWARE_DEFAULT);
    // The existing validation rules are not loosened by detection.
    expect(sanitizeTimezone("Asia/Tbilisi")).toBe("Asia/Tbilisi");
    expect(() => sanitizeTimezone("Not/AZone")).toThrow(/timezone/);
    expect(() => buildYaml({ ...DEFAULT_CONFIG, timezone: "Not/AZone" }, FIRMWARE.releaseVersion)).toThrow(/timezone/);
  });

  it("offers a visible re-apply action that shows the detected value", () => {
    const tune = (detected: string | null) => renderToStaticMarkup(
      <TuneSection cfg={DEFAULT_CONFIG} patch={() => {}} geo={geometry(DEFAULT_CONFIG.chips, DEFAULT_CONFIG.rows)} detected={detected} />);
    const available = tune("Asia/Tbilisi");
    expect(available).toContain("Use my timezone");
    expect(available).toContain("Detected: <code>Asia/Tbilisi</code>");
    expect(available).not.toContain('disabled="" title="Your browser does not report a timezone"');
    const unavailable = tune(null);
    expect(unavailable).toContain("Use my timezone");
    expect(unavailable).toContain("Automatic detection is unavailable in this browser");
  });
});
