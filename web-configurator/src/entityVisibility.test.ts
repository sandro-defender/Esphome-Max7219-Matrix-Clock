import { describe, expect, it } from "vitest";
import { FIRMWARE } from "./firmware";
import { switchTarget } from "./hardware";
import { renderScene } from "./render";
import { sanitizeHiddenEntities } from "./settingsModel";
import { decodeConfig, encodeConfig, sanitizeConfig } from "./storage";
import { DEFAULT_CONFIG } from "./types";
import { buildYaml } from "./yaml";

const tag = FIRMWARE.releaseVersion;

describe("Home Assistant exposure in installer YAML", () => {
  it("keeps every entity, especially diagnostics and recovery controls, exposed by default", () => {
    expect(DEFAULT_CONFIG.hiddenEntities).toEqual([]);
    expect(FIRMWARE.entities.every((entity) => entity.id && entity.visibilitySubstitution && entity.visibleByDefault)).toBe(true);
    for (const id of ["device_status", "wifi_signal_db", "ip_address", "ota_state", "restart_device", "button_return_to_clock", "button_restore_defaults"]) {
      expect(FIRMWARE.entities.find((entity) => entity.id === id)?.recommended, id).toBe(true);
    }
    const yaml = buildYaml(DEFAULT_CONFIG, tag);
    for (const entity of FIRMWARE.entities) expect(yaml).toContain(`${entity.visibilitySubstitution}: "false"`);
  });

  it.each(FIRMWARE.hardwareTargets.map((target) => target.id))("can hide every entity on %s without removing or duplicating its dependencies", (target) => {
    const cfg = { ...switchTarget(DEFAULT_CONFIG, target), brightness: 7, screen: "Date" as const,
      hiddenEntities: FIRMWARE.entities.map((entity) => entity.id) };
    const yaml = buildYaml(cfg, tag);
    for (const entity of FIRMWARE.entities) {
      expect(yaml.split(`${entity.visibilitySubstitution}: "true"`), entity.id).toHaveLength(2);
    }
    expect(yaml).not.toContain("!remove");
    // Initial settings still install for hidden entities, including font !extend.
    for (const setting of FIRMWARE.settings.filter((item) => ["select", "number", "switch"].includes(item.kind))) {
      expect(yaml.split(`- id: !extend ${setting.target}\n`), setting.target).toHaveLength(2);
    }
    expect(yaml).toContain('- id: !extend matrix_brightness\n    initial_value: 7');
    expect(yaml).toContain('- id: !extend screen_mode\n    initial_option: "Date"');
    for (const path of ["controls", "buttons", "date_controls", "actions", "diagnostics", "entity_visibility", "restore_defaults.generated"])
      expect(yaml).toContain(`packages/${path}.yaml`);
    expect(yaml).toContain('ha_hide_ip_address: "true"'); // nested wifi_info
    expect(yaml).toContain('ha_hide_free_heap: "true"'); // nested debug
  });

  it("changes only requested exposure flags, not preview or first-boot preferences", () => {
    const cfg = { ...DEFAULT_CONFIG, hiddenEntities: ["clock_font", "matrix_brightness", "device_info"] };
    const yaml = buildYaml(cfg, tag);
    for (const entity of FIRMWARE.entities) expect(yaml).toContain(`${entity.visibilitySubstitution}: "${cfg.hiddenEntities.includes(entity.id)}"`);
    const date = new Date(2026, 9, 2, 12, 34, 56);
    expect(renderScene(cfg, date, 0)).toEqual(renderScene(DEFAULT_CONFIG, date, 0));
    expect(yaml.split("# First-boot preferences")[1]).toBe(buildYaml(DEFAULT_CONFIG, tag).split("# First-boot preferences")[1]);
  });

  it("round-trips known entity IDs and discards unknown IDs, duplicate values and injection", () => {
    const input = ["clock_font", "clock_font", "device_info", "temperature_sensor", "api_encryption_key", "__proto__", "clock_font\ninternal: true", 1, null];
    expect(sanitizeHiddenEntities(input)).toEqual(["clock_font", "device_info"]);
    const cfg = sanitizeConfig({ hiddenEntities: input });
    expect(decodeConfig(encodeConfig(cfg))!.hiddenEntities).toEqual(cfg.hiddenEntities);
    expect(sanitizeConfig({ hiddenEntities: "clock_font" }).hiddenEntities).toEqual([]);
    const yaml = buildYaml(cfg, tag);
    expect(yaml).not.toContain("ha_hide_temperature_sensor");
    expect(yaml).not.toContain("__proto__");
    expect(yaml).not.toContain("internal: true");
  });

  it.each(FIRMWARE.hardwareTargets.map((target) => target.id))("omits only the optional web server and its unused secrets on %s", (target) => {
    const cfg = { ...switchTarget(DEFAULT_CONFIG, target), webServer: false, hiddenEntities: ["screen_mode"] };
    const yaml = buildYaml(cfg, tag);
    expect(yaml).not.toContain("packages/web_server.yaml");
    for (const setting of FIRMWARE.settings.filter((item) => item.requires === "webServer")) expect(yaml).not.toContain(`${setting.target}:`);
    expect(yaml).not.toContain("!secret web_server_");
    for (const name of ["wifi_password", "api_encryption_key", "fallback_ap_password"]) expect(yaml).toContain(`!secret ${name}`);
    expect(yaml).toContain("packages/ota_ui.yaml");
    expect(yaml).toContain("packages/network.yaml");
    expect(yaml).toContain('ha_hide_screen_mode: "true"');
    const enabled = buildYaml({ ...cfg, webServer: true, webServerPort: 8080, webServerVersion: 3 }, tag);
    expect(enabled).toContain("packages/web_server.yaml");
    expect(enabled).toContain('web_server_port: "8080"');
    expect(enabled).toContain('web_server_version: "3"');
    expect(enabled).toContain("web_server_password: !secret web_server_password");
  });
});
