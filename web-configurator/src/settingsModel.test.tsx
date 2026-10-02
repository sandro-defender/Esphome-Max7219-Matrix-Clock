// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { EntityVisibilitySection } from "./EntityVisibility";
import { FIRMWARE } from "./firmware";
import { switchTarget } from "./hardware";
import { geometry } from "./render";
import { TuneSection } from "./Settings";
import { SETTINGS_GROUPS } from "./settingsModel";
import { decodeConfig, encodeConfig, sanitizeConfig, saveConfig } from "./storage";
import { DEFAULT_CONFIG, type Config } from "./types";
import { buildYaml } from "./yaml";

let root: Root | undefined;
let host: HTMLDivElement;
let current: Config;
function Harness() {
  const [cfg, setCfg] = useState(DEFAULT_CONFIG);
  current = cfg;
  const patch = (key: keyof Config, value: Config[typeof key]) => setCfg((before) => ({ ...before, [key]: value }));
  return <>
    <TuneSection cfg={cfg} geo={geometry(cfg.chips, cfg.rows)} patch={patch} onTarget={(id) => setCfg((before) => switchTarget(before, id))} />
    <EntityVisibilitySection cfg={cfg} patch={patch} />
  </>;
}
function mount() {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root!.render(<Harness />));
}
afterEach(() => {
  if (root) act(() => root!.unmount());
  root = undefined;
  host?.remove();
  localStorage.clear();
});

function staticSettings(cfg = DEFAULT_CONFIG) {
  const document = new DOMParser().parseFromString(renderToStaticMarkup(<TuneSection cfg={cfg} patch={() => {}} geo={geometry(cfg.chips, cfg.rows)} />), "text/html");
  return document;
}

describe("compact settings model", () => {
  it("assigns every generated binding to exactly one compact card and an aligned labelled control", () => {
    const keys = SETTINGS_GROUPS.flatMap((group) => group.settings.map((item) => item.key));
    expect(keys.sort()).toEqual(FIRMWARE.settings.map((item) => item.key).sort());
    expect(new Set(keys).size).toBe(keys.length);
    const doc = staticSettings();
    for (const item of FIRMWARE.settings) {
      const wrappers = doc.querySelectorAll(`[data-setting-key="${item.key}"]`);
      expect(wrappers, item.key).toHaveLength(1);
      expect(wrappers[0].closest("fieldset")?.getAttribute("data-settings-group"), item.key).toBe(item.group);
      const row = wrappers[0].querySelector(".setting-row")!;
      expect(row, item.key).toBeTruthy();
      expect(row.querySelector(".field-label")?.textContent, item.key).toBeTruthy();
      for (const control of wrappers[0].querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select")) {
        expect(Boolean(control.getAttribute("aria-label") || control.labels?.length), item.key).toBe(true);
      }
    }
    expect(doc.querySelectorAll("[data-settings-group] details > summary")).toHaveLength(FIRMWARE.groups.length);
    expect(doc.querySelector('input[type="password"]')).toBeNull();
    for (const secret of Object.keys(FIRMWARE.secrets)) expect(doc.querySelector(`[name="${secret}"]`)).toBeNull();
  });

  it("uses native hardware radios and keeps board/pin/180-degree rules intact", () => {
    mount();
    act(() => host.querySelector<HTMLInputElement>('input[type="radio"][value="esp32"]')!.click());
    expect(current.target).toBe("esp32");
    expect(current.board).toBe("esp32dev");
    expect(current.clkPin).toBe("GPIO18");
    expect([...host.querySelectorAll<HTMLOptionElement>("#setting-clkPin option")].map((option) => option.value)).not.toContain("D8");
    const rotation = host.querySelector<HTMLSelectElement>("#setting-rotateChip")!;
    act(() => { rotation.value = "180"; rotation.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(current.rotateChip).toBe(180);
    expect(current.reverseEnable).toBe(true);
    expect(buildYaml(current, FIRMWARE.releaseVersion)).toContain('matrix_reverse_enable: "true"');
    act(() => host.querySelector<HTMLInputElement>('input[type="radio"][value="esp8266"]')!.click());
    expect(current.clkPin).toBe("D8");
    expect(current.rotateChip).toBe(180);
  });

  it("disables dependent web-server fields without losing their settings", () => {
    const cfg = { ...DEFAULT_CONFIG, webServer: false, webServerPort: 8080, webServerVersion: 3 };
    const doc = staticSettings(cfg);
    for (const item of FIRMWARE.settings.filter((setting) => setting.requires === "webServer")) {
      for (const control of doc.querySelectorAll<HTMLInputElement | HTMLSelectElement>(`[data-setting-key="${item.key}"] input, [data-setting-key="${item.key}"] select`)) expect(control.disabled).toBe(true);
    }
    expect(decodeConfig(encodeConfig(cfg))!.webServerPort).toBe(8080);
    const yaml = buildYaml({ ...cfg, webServer: true }, FIRMWARE.releaseVersion);
    expect(yaml).toContain('web_server_port: "8080"');
  });

  it("keeps exposure controls aligned and preserves recommended defaults when hiding optional controls", () => {
    mount();
    const rows = host.querySelectorAll(".entity-row");
    expect(rows).toHaveLength(FIRMWARE.entities.length);
    for (const entity of FIRMWARE.entities) {
      const row = host.querySelector(`[data-entity-id="${entity.id}"]`)!;
      expect(row.querySelector(".entity-label")!.textContent).toContain(entity.name);
      expect(row.querySelector<HTMLInputElement>("input")!.checked).toBe(true);
    }
    act(() => [...host.querySelectorAll("button")].find((button) => button.textContent === "Hide optional controls")!.click());
    expect(current.hiddenEntities.length).toBeGreaterThan(10);
    for (const entity of FIRMWARE.entities.filter((item) => item.recommended || item.group === "Diagnostics")) expect(current.hiddenEntities).not.toContain(entity.id);
    const font = host.querySelector<HTMLInputElement>('[data-entity-id="clock_font"] input')!;
    expect(font.checked).toBe(false);
    act(() => font.click());
    expect(current.hiddenEntities).not.toContain("clock_font");
    expect(buildYaml(current, FIRMWARE.releaseVersion)).toContain('ha_hide_clock_font: "false"');
    act(() => [...host.querySelectorAll("button")].find((button) => button.textContent === "Expose all entities")!.click());
    expect(current.hiddenEntities).toEqual([]);
    expect(host.textContent).toContain("not a live Home Assistant UI preference");
    expect(host.textContent).toContain("Rebuild and install");
  });

  it("uses one text-length model and strips unknown/secret properties on every persistence path", () => {
    const comment = "A safe device description. ".repeat(5);
    const unsafe = { ...DEFAULT_CONFIG, deviceComment: comment, wifi_password: "NEVER_SAVE_ME", api_encryption_key: "NEVER_SAVE_ME", ota_password: "NEVER_SAVE_ME", web_server_password: "NEVER_SAVE_ME" };
    const clean = sanitizeConfig(unsafe);
    expect(clean.deviceComment).toBe(comment);
    expect(decodeConfig(encodeConfig(unsafe))!.deviceComment).toBe(comment);
    expect(JSON.stringify(decodeConfig(encodeConfig(unsafe)))).not.toContain("NEVER_SAVE_ME");
    saveConfig(unsafe);
    expect(localStorage.getItem("max7219-clock.config.v1")).not.toContain("NEVER_SAVE_ME");
    expect(buildYaml(clean, FIRMWARE.releaseVersion)).toContain(JSON.stringify(comment));
    expect(sanitizeConfig({ webServerVersion: 99 }).webServerVersion).toBe(DEFAULT_CONFIG.webServerVersion);
  });

  it("validates safe network text and bounds timers and ports to firmware-safe integers", () => {
    for (const input of [
      { temperatureEntity: "light.desk" }, { temperatureEntity: "sensor.unsafe\nname" },
      { sntpServer1: "https://pool.ntp.org" }, { sntpServer2: "999.999.1.1" },
      { fallbackSsid: "" }, { fallbackSsid: "🙂".repeat(9) }, { deviceComment: "bad\u0000comment" },
      { sntpServer1: "${api_encryption_key}" }, { deviceComment: "unpaired \ud800" },
    ]) expect(() => buildYaml({ ...DEFAULT_CONFIG, ...input }, FIRMWARE.releaseVersion)).toThrow();
    const cfg = sanitizeConfig({ webServerPort: 99999, wifiRebootTimeout: -1, sntpUpdateInterval: 0, displayUpdateMs: Infinity });
    expect(cfg.webServerPort).toBe(65535);
    expect(cfg.wifiRebootTimeout).toBe(0);
    expect(cfg.sntpUpdateInterval).toBe(1);
    expect(cfg.displayUpdateMs).toBe(DEFAULT_CONFIG.displayUpdateMs);
    expect(buildYaml({ ...cfg, sntpServer1: "192.0.2.1", sntpServer2: "time.example.org", wifiPowerSave: "LIGHT" }, FIRMWARE.releaseVersion)).toContain('wifi_power_save_mode: "LIGHT"');
  });


});
