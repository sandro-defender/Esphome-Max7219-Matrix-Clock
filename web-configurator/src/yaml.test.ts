import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { DEFAULT_CONFIG } from "./types";
import { buildYaml } from "./yaml";

describe("buildYaml", () => {
  it("creates one install YAML that loads every pinned firmware module", () => {
    const yaml = buildYaml(DEFAULT_CONFIG);

    expect(yaml).toContain("url: https://github.com/sandro-defender/Esphome-Max7219-Matrix-Clock");
    expect(yaml).toContain('ref: "0.1.0"');
    expect(yaml).toContain('project_ref: "0.1.0"');
    expect(yaml).toContain("- packages/base.yaml");
    expect(yaml).toContain("- packages/fonts_web.yaml");
    expect(yaml).toContain("- packages/ota_ui.yaml");
    expect(yaml).toContain("- packages/web_server.yaml");
    expect(yaml.split("\n").length).toBeLessThan(180);
  });

  it("stays synchronized with the checked-in release installer", () => {
    const generated = buildYaml(DEFAULT_CONFIG);
    const release = readFileSync(new URL("../../examples/release.yaml", import.meta.url), "utf8");
    const packagePattern = /^\s+- (packages\/[a-z0-9_-]+\.yaml)$/gm;
    const filesFrom = (yaml: string) => [...yaml.matchAll(packagePattern)].map((match) => match[1]);

    expect(filesFrom(generated)).toEqual(filesFrom(release));
    expect(generated.match(/^\s+project_ref: "([^"]+)"$/m)?.[1]).toBe(
      release.match(/^\s+project_ref: "([^"]+)"$/m)?.[1],
    );
    expect(generated.match(/^\s+ref: "([^"]+)"$/m)?.[1]).toBe(release.match(/^\s+ref: "([^"]+)"$/m)?.[1]);
  });

  it("keeps credentials local and never emits built-in secret values", () => {
    const yaml = buildYaml(DEFAULT_CONFIG);

    expect(yaml).toContain("wifi_ssid: !secret wifi_ssid");
    expect(yaml).toContain("api_encryption_key: !secret api_encryption_key");
    expect(yaml).toContain("fallback_ap_password: !secret fallback_ap_password");
    expect(yaml).toContain("web_server_password: !secret web_server_password");
    expect(yaml).not.toMatch(/[A-Za-z0-9+/]{43}=/);
    expect(yaml).not.toContain("qrD7jAZbaZ38");
  });

  it("writes sanitized device and hardware substitutions", () => {
    const yaml = buildYaml({
      ...DEFAULT_CONFIG,
      deviceName: " Kitchen Clock!! ",
      friendlyName: 'Kitchen "Clock"\n',
      timezone: "Europe/Tbilisi",
      clkPin: "D5",
      mosiPin: "D7",
      csPin: "D8",
      chips: 8,
      rows: 2,
      brightness: 9,
    });

    expect(yaml).toContain("device_name: kitchen-clock");
    expect(yaml).toContain('friendly_name: "Kitchen Clock"');
    expect(yaml).toContain("timezone: Europe/Tbilisi");
    expect(yaml).toContain("matrix_clk_pin: D5");
    expect(yaml).toContain('matrix_chips: "8"');
    expect(yaml).toContain('matrix_rows: "2"');
    expect(yaml).toContain('matrix_intensity: "9"');
  });

  it("maps preview preferences to supported package entity defaults", () => {
    const yaml = buildYaml({
      ...DEFAULT_CONFIG,
      alignment: "Right",
      hourFormat: "12-hour",
      showSeconds: false,
      secondBar: false,
      blinkColon: false,
      displayPower: false,
      nightDim: true,
    });

    expect(yaml).toContain("id: !extend clock_alignment\n    initial_option: \"Right\"");
    expect(yaml).toContain("id: !extend time_format\n    initial_option: \"12 hour\"");
    expect(yaml).toContain("id: !extend seconds_display\n    initial_option: \"Off\"");
    expect(yaml).toContain("id: !extend clock_blink\n    restore_mode: RESTORE_DEFAULT_OFF");
    expect(yaml).toContain("id: !extend matrix_display_power\n    restore_mode: RESTORE_DEFAULT_OFF");
    expect(yaml).toContain("id: !extend night_schedule_enabled\n    restore_mode: RESTORE_DEFAULT_ON");
  });
});
