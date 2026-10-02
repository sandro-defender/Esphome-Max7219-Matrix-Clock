# Roadmap

Open work only, each item with acceptance criteria. Completed work is history
([docs/HISTORY.md](docs/HISTORY.md)); released behaviour is user documentation
([README.md](README.md)). Nothing here is a release promise.

## 1. Automatic timezone detection in the web configurator

Status: not implemented. `timezone` is a free-text substitution in
`packages/base.yaml` (default `Europe/Berlin`), exposed through
`packages/configurator.json`, validated by `sanitizeTimezone()` in
`web-configurator/src/yaml.ts`, and written into the generated installer YAML
used by Home Assistant time and the SNTP fallback.

Acceptance criteria:

- [ ] On first visit (no saved config, no shared link) the Timezone field is
      pre-filled from `Intl.DateTimeFormat().resolvedOptions().timeZone`,
      validated through `sanitizeTimezone()`.
- [ ] Detection failure or an invalid/unknown zone keeps the firmware default
      (`Europe/Berlin`).
- [ ] A visible "Use my timezone" action next to the field re-applies the
      detected zone at any time and shows the detected value.
- [ ] A saved config or shared link that already contains a timezone is never
      overwritten by detection.
- [ ] The detected zone flows unchanged into the installer YAML
      (`timezone: <zone>`) and the live preview.
- [ ] Purely client-side: no geolocation, no IP lookup, no permission prompt,
      nothing sent anywhere.
- [ ] Tests in `web-configurator/src/` cover first-visit detection, invalid-zone
      fallback, saved-config/share-link precedence, and the generated YAML.

## 2. Current firmware build and size measurement

Status: **Unverified**. No linked ESP8266 binary or flash/RAM measurement exists
for the current source; CI never compiles firmware.

- [ ] Compile `dev.yaml` (and one installer YAML from the configurator) on a
      build host with ESPHome 2026.9.1 exactly; record the commit, toolchain
      versions and final `INFO Successfully compiled program.`
- [ ] Record flash/RAM bytes and headroom for the default font pair and for the
      largest selectable subset in [VALIDATION.md](VALIDATION.md) and
      [packages/fonts/README.md](packages/fonts/README.md), with the date and
      SDK version; clearly separate the historical 2026.9.0/`0.4.0` numbers.

## 3. Physical-device verification

Status: **Unverified**. All of these need a real 48×8 panel and a flashed board.

- [ ] Default pair readability, including the repaired Matrix 2px zero, and
      degenerate layouts (narrow panel, multi-row, rotation, flip).
- [ ] Changed-digit-only slide-up motion, duration 0 and gap extremes,
      `millis()` rollover at midnight and hour rollover.
- [ ] Boot splash shows the installed version, then restored screen and power
      state; Wi-Fi/API reconnection after a power cut.
- [ ] Encrypted OTA with visible start, percentage, bar, `100%`, error code and
      restoration — including display off, inversion, zero brightness, night and
      alarm preferences.
- [ ] Wiring/orientation checks with both built-in test patterns.

## 4. Retained preview timelines for countdown, alert, boot and OTA

Status: covered for the normal screen and messages only.

- [ ] Extend the sequential native/browser fixture to countdown, alert, boot and
      OTA event sequences, keeping `Report` screen changes applied after the
      frame like the firmware.
- [ ] Assert visible pixels, mode/page, brightness and timers for each sequence;
      do not claim parity for paths without tests.

## 5. Legacy validator migration

Status: `scripts/validate-release-offline.sh` copies the whole working tree and
must not be run with a production `secrets.yaml` present.

- [ ] Replace or rewrite it so it copies only the files it needs (as
      `scripts/validate.py` does), or delete it once `scripts/validate.py`
      covers the release path.
- [ ] Remove the warning in [VALIDATION.md](VALIDATION.md) and state the
      replacement's exact coverage.

## 6. Manual interface review

Status: no browser automation is used.

- [ ] Keyboard-only pass over the configurator (tabs, disclosures, Font Lab,
      copy/download) and a screen-reader spot check.
- [ ] Reduced-motion and small-screen (≤320 px) review of the current
      deployment; record date, browser and findings.

## 7. ESPHome target change

Status: pinned to 2026.9.1.

- [ ] One PR that bumps `min_version` in `packages/base.yaml`,
      `requirements-validation.txt`, `project_ref` and the `CHANGELOG.md`
      section, regenerates the contract and glyphs, and updates every dated
      version reference in the docs.
