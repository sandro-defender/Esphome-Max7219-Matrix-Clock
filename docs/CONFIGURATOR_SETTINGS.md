# Configurator settings audit

Audit for the 0.7.8 configurator, against ESPHome **2026.9.1** and both base
packages. The supported project surface is defined by
[`packages/configurator.json`](../packages/configurator.json) and the package
YAML, not every option in the entire ESPHome SDK. Defaults, options, bounds,
entity IDs and the module/font catalogue come from the generated contract;
this document classifies coverage rather than duplicating those values.

## Coverage

| Surface / source | Configurator / installer behavior |
| --- | --- |
| Identity: `device_name`, `friendly_name`, `device_comment`, `timezone` | Device card. Automatic timezone is a browser policy; the resolved IANA zone is written to both time sources through the existing substitution. |
| Hardware: `board`, `matrix_clk_pin`, `matrix_mosi_pin`, `matrix_cs_pin`, `matrix_chips`, `matrix_rows`, `matrix_wiring`, `matrix_rotate_chip`, `matrix_reverse_enable`, `matrix_flip_x` | Target picker and Hardware card. ESPHome board/pin tables remain target-specific; aliases must resolve to distinct output GPIOs, and module count must divide into rows. Selecting 180° also selects chain reversal. |
| Timing, logs, OTA: `log_level`, `ota_port`, `display_update_interval`, `boot_version_duration`, `ota_display_intensity` | Advanced card. Durations and ports are bounded; redraw timing also fits the browser's signed timer range. |
| Imported Home Assistant temperature: `temperature_entity` | Screens card; numeric `sensor.*` entity in °C. The import stays internal and is not re-exported to Home Assistant. |
| All selects in `controls.yaml` | Clock, Screens and Messages cards, including all screen, time/date/seconds, alignment, scroll and compiled font choices. |
| All numbers in `controls.yaml` and `date_controls.yaml` | Clock, Screens, Light and Messages cards. Includes date scroll speed, separate clock/date dwell times, countdown duration and night schedule. Initial-value substitutions and entity overrides use the same value. |
| All switches in `controls.yaml` | Includes display power, colon blink, digit animation, auto cycle, manual/scheduled night mode, alarm mode and inversion. |
| All named entities in `controls.yaml`, `date_controls.yaml`, `buttons.yaml`, `diagnostics.yaml` | Home Assistant visibility. Includes nested `debug` and `wifi_info` children as well as every convenience/recovery button. No named entity is silently omitted. |
| Network: `fallback_ap_ssid`, `fallback_ap_timeout`, `wifi_reboot_timeout`, `wifi_power_save_mode`, `api_reboot_timeout`, `sntp_server_1`, `sntp_server_2`, `sntp_update_interval` | Network card. The formerly fixed, safe options are substitutions. Zero disables the selected reboot/fallback timer, not its credentials or the encrypted API. SNTP accepts hostnames or IPv4 addresses, not URLs. |
| Optional `web_server.yaml`: inclusion, `web_server_port`, `web_server_version`, `web_server_auth_type`, `web_server_log` | Web server card. Disabling it omits only this package, its dependent substitutions and its otherwise unused secret references. Native API/OTA stay installed. Authentication stays mandatory. |
| Fonts | Font Lab controls optional per-face packages; Clock selects an included face. The default pair and built-in fallback policy are unchanged. |
| Runtime buttons and `api.actions` in `actions.yaml` | Buttons have exposure choices; actions, their parameters and examples remain in Info & help. Presses, message/status text and active countdowns are transient device actions, not install-time preferences. The page does not connect to or control a device. |
| LED colour, module guides, message demo, frozen preview time | Explicitly preview-only. Never emitted into firmware YAML. Visibility choices do not change preview pixels. |

All restored select/number/switch values are **first-boot defaults**. A previously
saved preference on the device wins after flashing, even if its entity is now
internal. Hiding an entity does not reset its state or change the renderer.

## Exposure semantics

Each named entity has a stable ID and `internal: ${ha_hide_<id>}`. Defaults live
in [`packages/entity_visibility.yaml`](../packages/entity_visibility.yaml) and
keep every entity exposed, including diagnostics and recovery controls. The
configurator stores an allowlisted array of hidden IDs and emits boolean
substitution values, not `!remove` directives or duplicate `!extend` entities.
Nested diagnostics use the same mechanism as top-level controls.

This is **compile-time firmware configuration**, not a live Home Assistant UI
preference: rebuild and install to change discovery. Internal entities still
exist for lambdas, scripts, restored values, API actions and display updates,
but are not advertised to Home Assistant or the device web server. Old Home
Assistant registry entries may remain unavailable and need user cleanup.
`disabled_by_default` (OTA percent) is a different mechanism: the entity is
exposed, but initially disabled in Home Assistant.

“Hide optional controls” leaves recommended recovery controls and diagnostic
choices unchanged. Every entity is individually configurable, with recommended
ones labelled. API actions are not entities and remain available.

## Deliberately not configurable

- Wi-Fi SSID/password, fallback hotspot password, API/encrypted-OTA key and web
  login values: only symbolic `!secret` references from the local user YAML.
  No credential input, storage field or shared-link field exists. Native OTA
  uses the API key; there is no separate OTA password setting.
- `project_ref`, `project_repo`, `project_version`, `fonts_base_url`: release
  provenance and immutable package/font pins, owned by release verification.
- API/OTA encryption, mandatory web authentication, `web_server.ota: false` and
  `web_server.include_internal: false`: security/exposure invariants.
- ESP8266 flash preference restoration, target framework, component IDs,
  renderer-owned scrolling, time-source precedence, diagnostic polling limits,
  font glyph/build flags and OTA error/recovery timeouts: implementation
  invariants, not independently tunable user preferences.
- Arbitrary SDK extensions (static IPs, other network transports, extra display
  drivers, custom components): not part of the clock's supported binding set.
  They still belong in a user's own ESPHome YAML.

## Regression guards

The contract generator rejects unmapped substitutions, adjustable entities,
missing/duplicate exposure flags, invalid groups and IDs that shadow included
integrations. Web tests check compact labelled controls, persistence filtering,
automatic timezone transitions and preview/installer parity. Python regressions
merge real browser/CLI-generated YAML through the pinned SDK's package and
substitution helpers for both targets, optional web-server states and exposed,
mixed and all-internal entity selections.

Actual YAML validation is a separate, explicit command:

```bash
python scripts/validate.py --config-only
```

It uses isolated local package/font copies and deterministic fake secrets, never
production credentials. It validates both targets, all-internal/no-web profiles
and web-v3/digest profiles, without compiling firmware. See
[VALIDATION.md](../VALIDATION.md) for the code gate and its limits.
