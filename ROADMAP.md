# ESPHome 2026.9 MAX7219 Clock Roadmap

This is the implementation contract for turning the existing YAML into a
polished, secure, resource-conscious MAX7219 clock with extensive Home
Assistant control. Complete the phases in order. Do not mark a checkbox without
evidence from source inspection, tests, validation, compilation, or hardware.

Official starting points:

- [ESPHome 2026.9.0 release notes](https://esphome.io/changelog/2026.9.0/)
- [Native API](https://esphome.io/components/api/)
- [MAX7219 Digit Display](https://esphome.io/components/display/max7219digit/)
- [OTA automations](https://esphome.io/components/ota/#ota-automations)
- [ESPHome OTA encryption](https://esphome.io/components/ota/esphome/)
- [Web Server](https://esphome.io/components/web_server/)
- [Packages](https://esphome.io/components/packages/)
- [Substitutions](https://esphome.io/components/substitutions/)
- [Font Renderer](https://esphome.io/components/font/)

## Phase 0 — Protect existing work

- [ ] Read `AGENTS.md`, this roadmap, the README, YAML, tests, scripts, and
      current Git diff.
- [ ] Identify which files are committed, staged, modified, and untracked.
- [ ] Preserve existing user work and avoid broad cleanup or destructive Git
      commands.
- [ ] Confirm the active board, module count, rows, wiring pattern, rotation,
      and pins from the configuration rather than guessing.
- [ ] Scan tracked and staged content for embedded credentials.
- [ ] Keep `secrets.yaml`, build output, and validation environments ignored.

## Phase 1 — Establish tests and compatibility rules

- [ ] Pin validation tooling to `esphome==2026.9.0`.
- [ ] Add or update a regression test before each behavioral change.
- [ ] Test that `esphome.min_version` is `2026.9.0`.
- [ ] Test that modern `api.actions` syntax is used and legacy
      `api.services` is absent.
- [ ] Test that native OTA encryption is configured.
- [ ] Test that no literal production credentials are tracked.
- [ ] Test full-size `HH:MM:SS`, slide animation, countdown, OTA progress, and
      the required Home Assistant entities.
- [ ] Make test names describe user-visible behavior.

## Phase 2 — Migrate cleanly to ESPHome 2026.9.0

- [ ] Review all 2026.9.0 breaking changes relevant to ESP8266, API actions,
      OTA, web server, display lambdas, and template entities.
- [ ] Add `min_version: "2026.9.0"` and project metadata.
- [ ] Use the board substitution consistently instead of a second hard-coded
      board value.
- [ ] Replace user-defined API `services` with `actions`.
- [ ] Add concise action and variable metadata while keeping every ESP8266
      action comfortably below the documented 384-byte metadata limit.
- [ ] Configure encrypted native OTA using the existing API key; never generate
      a replacement key for an installed device.
- [ ] Follow the official two-step migration if an installed device currently
      uses an OTA password.
- [ ] Disable regular web-server OTA when it would leave a plaintext firmware
      upload endpoint.

## Phase 3 — Split the configuration into remote packages

The repository must distribute a small user-facing device file and a set of
focused package files. Do not leave the complete implementation in one YAML
file.

- [ ] Keep the user-facing example YAML limited to local secrets, substitutions,
      and a remote `packages` declaration.
- [ ] Load the project package from
      `github://sandro-defender/Esphome-Max7219-Matrix-Clock/...` so ESPHome
      downloads it directly from this repository.
- [ ] Pin release examples to a version tag; use `@main` only in a clearly
      labelled development example.
- [ ] Split the implementation into focused files under `packages/`, including
      base/device, network/API/OTA, display hardware, fonts, renderer/state,
      Home Assistant controls, API actions, diagnostics, and OTA UI.
- [ ] Use local `!include` files inside the repository only where ESPHome's
      remote-package resolver is proven to fetch the complete dependency tree.
      Otherwise list every required package file explicitly in the remote
      `files` collection.
- [ ] Give every package-owned component a stable, unique `id` so ESPHome's
      package merge behavior is predictable.
- [ ] Put safe defaults in `substitutions` and allow the small user YAML to
      override them.
- [ ] Expose board, pins, module count, rows, wiring, rotation, flip, device
      names, timezone, update intervals, and feature flags as substitutions
      where compile-time configuration is appropriate.
- [ ] Pass credentials from the local YAML as substitutions backed by local
      `!secret` values, because remote packages cannot resolve secrets.
- [ ] Never place a credential, private repository token, SSH key, or API key
      in the remote package.
- [ ] Add a local development entry point that uses the same package modules
      without needing a GitHub round trip.
- [ ] Add automated validation for both the local-development entry point and
      the public remote-package example.
- [ ] Document cache refresh behavior and how users pin or upgrade a release.

## Phase 4 — Add repository-hosted fonts and font selection

Font source files and their license files belong in `fonts/`. Release builds
must fetch font files directly from this public repository using ESPHome's web
font source instead of requiring users to copy fonts beside their YAML.

- [x] Add Tiny5 and Press Start 2P source files under `fonts/` with their SIL
      Open Font License files.
- [ ] Reference fonts with explicit `type: web` URLs under
      `https://raw.githubusercontent.com/sandro-defender/Esphome-Max7219-Matrix-Clock/<tag>/fonts/...`.
- [ ] Pin production font URLs to the same release tag as the package; do not
      silently mix `main` font assets with a tagged package release.
- [ ] Keep a built-in compact 5×7 fallback so the clock remains usable if an
      optional font cannot meet the 48×8 layout.
- [ ] Precompile every selectable font at build time; runtime font selection
      must switch between compiled font IDs and must not perform network access.
- [ ] Add a Home Assistant `select` entity for clock font.
- [ ] Add a separate message-font selector only if flash/RAM measurements show
      safe ESP8266 headroom.
- [ ] Limit each font's `glyphs` to the characters actually used by clock,
      countdown, message, and OTA screens, including digits, separators, `%`,
      spaces, and required status letters.
- [ ] Use `bpp: 1` unless measurements justify a larger value.
- [ ] Verify every font fits full-size `HH:MM:SS`, remains readable at 8 pixels
      high, and works with per-digit slide-up animation.
- [ ] Test missing glyphs, metrics, clipping, alignment, and fallback behavior.
- [ ] Record firmware size for each enabled font and remove low-value choices
      if ESP8266 headroom becomes unsafe.
- [ ] Document font sources, licenses, raw download URLs, supported glyphs, and
      the steps for adding another font.

## Phase 5 — Make display state explicit

- [ ] Define clear modes for Clock, Date, Message, Countdown, OTA, module-grid
      test, and pixel-checkerboard test.
- [ ] Give OTA the highest display priority, followed by temporary alerts,
      countdown, and normal screens.
- [ ] Keep temporary runtime state out of flash.
- [ ] Restore only durable user preferences.
- [ ] Keep Home Assistant entity state and internal display state synchronized
      after boot.
- [ ] Make expiration calculations safe across `millis()` rollover.
- [ ] Provide a readable fallback when Home Assistant time is unavailable.

## Phase 6 — Build the clock renderer

- [ ] Render hours, minutes, and seconds with the same 5×7 font.
- [ ] Fit full `HH:MM:SS` inside the default 48×8 six-module display.
- [ ] Fall back gracefully when the configured matrix is too narrow.
- [ ] Support 12-hour and 24-hour modes, including correct midnight/noon and a
      blank leading digit when appropriate.
- [ ] Keep clock, date, countdown, message, and test screens within bounds.
- [ ] Preserve the seconds progress-bar alternative.
- [ ] Clip off-screen animation drawing safely.
- [ ] Avoid blocking delays and unnecessary dynamic allocation in the display
      lambda.

## Phase 7 — Add per-digit slide-up animation

- [ ] Animate only digits whose value changed.
- [ ] Move the old digit upward while the new digit enters from below.
- [ ] Keep unchanged digits and separators stationary.
- [ ] Make animation non-blocking and rollover-safe.
- [ ] Expose animation enable/disable to Home Assistant.
- [ ] Expose animation duration or speed when it can be implemented safely.
- [ ] Disable ordinary digit animation while OTA status is active.
- [ ] Verify transitions at second, minute, hour, day, and 12/24-hour
      boundaries.

## Phase 8 — Expose useful Home Assistant controls

Expose real runtime capabilities only. Keep board type, pins, chip count, row
count, and physical wiring as compile-time substitutions.

### Select entities

- [ ] Display mode.
- [ ] 12/24-hour format.
- [ ] Seconds display mode.
- [ ] Clock alignment.
- [ ] Date format.
- [ ] Animation style, if multiple tested styles exist.
- [ ] Message scroll behavior.
- [ ] Matrix test pattern.
- [ ] Clock font, selecting only from fonts compiled into the firmware.

### Number entities

- [ ] Matrix brightness from 0 to 15.
- [ ] Animation duration or speed.
- [ ] Message scrolling speed.
- [ ] Default message duration.
- [ ] Countdown duration.
- [ ] Automatic screen-cycle interval.
- [ ] Day and night brightness.

### Switch entities

- [ ] Display power.
- [ ] Blinking colon.
- [ ] Digit animation.
- [ ] Automatic screen cycling.
- [ ] Night mode.
- [ ] Display inversion only if the official runtime API safely supports it.
- [ ] Automatic brightness only when a real light sensor is configured.

### Button entities

- [ ] Restart device.
- [ ] Return to clock.
- [ ] Clear message.
- [ ] Start and cancel countdown.
- [ ] Run module-grid and pixel tests.
- [ ] Restore safe display defaults.

### Diagnostic entities

- [ ] Wi-Fi signal, uptime, IP address, connected SSID, ESPHome version, and
      reset reason where officially supported.
- [ ] Current display mode.
- [ ] Countdown state or remaining time at a network-friendly update rate.
- [ ] Free heap or other useful ESP8266 diagnostics only through supported
      components.
- [ ] Correct `entity_category`, units, icons, device classes, update intervals,
      restore behavior, and safe defaults.

## Phase 9 — Add parameterized API actions

- [ ] Show a scrolling message with validated text and duration.
- [ ] Clear the current message.
- [ ] Start a countdown with clamped input.
- [ ] Cancel the countdown.
- [ ] Temporarily show date or status information when useful.
- [ ] Add response-enabled status queries only when they provide real value.
- [ ] Use `api.respond` only according to ESPHome 2026.9 documentation.
- [ ] Handle empty strings, invalid values, overflow, and excessive durations.

## Phase 10 — Show firmware-upload status

Use the native OTA platform's documented `on_begin`, `on_progress`, `on_end`,
and `on_error` automations.

- [ ] On start, override every other screen and show `OTA` or `UPDATE`.
- [ ] During upload, show a clamped integer percentage from 0 to 100.
- [ ] Draw a bottom-row progress bar in addition to the percentage.
- [ ] Redraw only when the displayed integer percentage changes.
- [ ] On success, show `DONE` or `100%` immediately before reboot.
- [ ] On failure, show `ERROR` and the numeric error code when space permits.
- [ ] Restore the previous screen and display-power state after an error.
- [ ] Keep OTA state temporary and never write progress to flash.
- [ ] Expose an OTA-state diagnostic text sensor with `Idle`, `Starting`,
      `Uploading`, `Success`, and `Error` states.
- [ ] Optionally expose a percentage sensor, disabled by default and
      rate-limited to meaningful changes.
- [ ] Do not rely on the normal display update loop: OTA blocks the application
      loop while uploading.
- [ ] Update the MAX7219 immediately from OTA callbacks using a documented,
      non-blocking mechanism verified by compilation and, when possible,
      hardware testing.
- [ ] Keep every progress callback very short so display feedback cannot break
      the firmware transfer.

## Phase 11 — Add useful clock functions

- [ ] Countdown completion message with safe timeout behavior.
- [ ] Temporary scrolling notifications from Home Assistant.
- [ ] Optional automatic clock/date cycling.
- [ ] Configurable day/night brightness schedule.
- [ ] Time-synchronization status and fallback display.
- [ ] Wiring, orientation, and pixel test modes.
- [ ] Do not add integrations for sensors or hardware that are not present.

## Phase 12 — Security and resource review

- [ ] Keep every credential behind `!secret` and update
      `secrets.yaml.example` without real values.
- [ ] Use encrypted native API and encrypted native OTA.
- [ ] Document web-server authentication and network-isolation expectations.
- [ ] Avoid exposing unauthenticated firmware upload paths.
- [ ] Review generated firmware RAM and flash usage.
- [ ] Remove or simplify low-value functionality if ESP8266 headroom becomes
      unsafe.
- [ ] Avoid rapid diagnostic publishing and excessive API traffic.
- [ ] Confirm arrays, positions, digits, durations, and brightness values are
      bounded.

## Phase 13 — Validation tooling

- [ ] Keep `tests/test_config.py`, `scripts/validate.ps1`,
      `requirements-validation.txt`, and `VALIDATION.md` current.
- [ ] Make the validator use temporary non-production secrets.
- [ ] Never read, print, or modify the real `secrets.yaml`.
- [ ] Return a failing exit code for every failed test, validation, or compile.
- [ ] Clean up only the exact temporary directory created by the validator.
- [ ] Support dependency installation, offline reuse, YAML validation, and full
      firmware compilation.
- [ ] Run the regression suite.
- [ ] Run ESPHome 2026.9.0 `config` validation.
- [ ] Run a complete ESP8266 firmware compile.
- [ ] Validate that a clean temporary configuration can fetch all remote package
      YAML and web-font assets without relying on untracked local files.
- [ ] Perform a real OTA upload test when hardware is available and record
      whether progress was visible throughout the transfer.

## Phase 14 — Documentation and release

- [ ] Update the README with hardware, wiring, secrets, installation, OTA
      migration, Home Assistant controls, actions, validation, and
      troubleshooting.
- [ ] Document hardware-dependent limitations and anything not tested on a
      physical matrix.
- [ ] Review the staged diff and scan it for secrets.
- [ ] Commit one logical, verified increment at a time using conventional commit
      messages.
- [ ] Never force-push.
- [ ] Push only after tests, configuration validation, and firmware compilation
      pass.
- [ ] Confirm local `HEAD` matches the remote `main` branch.

## Definition of done

- [ ] All regression tests pass.
- [ ] ESPHome 2026.9.0 reports the configuration as valid.
- [ ] The full ESP8266 firmware compiles successfully.
- [ ] Full-size `HH:MM:SS` fits the default 48×8 matrix.
- [ ] Slide-up animation is non-blocking and affects only changed digits.
- [ ] OTA start, progress, success, and error screens are implemented.
- [ ] Useful runtime settings are exposed cleanly to Home Assistant.
- [ ] No credential or generated build artifact is committed.
- [ ] Firmware size leaves safe ESP8266 headroom.
- [ ] Documentation describes the final implementation accurately.
- [ ] A minimal example downloads pinned package files and font assets directly
      from the GitHub release without copying the repository locally.
- [ ] The final report lists features, entities, API actions, compatibility
      migrations, test results, build size, files changed, commit, push status,
      and remaining hardware-only verification.
