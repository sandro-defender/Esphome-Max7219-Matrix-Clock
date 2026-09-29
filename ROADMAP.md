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

- [x] Read `AGENTS.md`, this roadmap, the README, YAML, tests, scripts, and
      current Git diff.
- [x] Identify which files are committed, staged, modified, and untracked.
- [x] Preserve existing user work and avoid broad cleanup or destructive Git
      commands.
- [x] Confirm the active board, module count, rows, wiring pattern, rotation,
      and pins from the configuration rather than guessing.
- [x] Scan tracked and staged content for embedded credentials.
- [x] Keep `secrets.yaml`, build output, and validation environments ignored.

## Phase 1 — Establish tests and compatibility rules

- [x] Pin validation tooling to `esphome==2026.9.0`.
- [x] Add or update a regression test before each behavioral change.
- [x] Test that `esphome.min_version` is `2026.9.0`.
- [x] Test that modern `api.actions` syntax is used and legacy
      `api.services` is absent.
- [x] Test that native OTA encryption is configured.
- [x] Test that no literal production credentials are tracked.
- [x] Test full-size `HH:MM:SS`, slide animation, countdown, OTA progress, and
      the required Home Assistant entities.
- [x] Make test names describe user-visible behavior.

## Phase 2 — Migrate cleanly to ESPHome 2026.9.0

- [x] Review all 2026.9.0 breaking changes relevant to ESP8266, API actions,
      OTA, web server, display lambdas, and template entities.
- [x] Add `min_version: "2026.9.0"` and project metadata.
- [x] Use the board substitution consistently instead of a second hard-coded
      board value.
- [x] Replace user-defined API `services` with `actions`.
- [x] Add concise action and variable metadata while keeping every ESP8266
      action comfortably below the documented 384-byte metadata limit.
- [x] Configure encrypted native OTA using the existing API key; never generate
      a replacement key for an installed device.
- [x] Follow the official two-step migration if an installed device currently
      ... not applicable: the v2.0 firmware had no OTA password (verified in git history)
      uses an OTA password.
- [x] Disable regular web-server OTA when it would leave a plaintext firmware
      upload endpoint.

## Phase 3 — Split the configuration into remote packages

The repository must distribute a small user-facing device file and a set of
focused package files. Do not leave the complete implementation in one YAML
file.

- [x] Keep the user-facing example YAML limited to local secrets, substitutions,
      and a remote `packages` declaration.
- [x] Load the project package from
      ... the explicit `url` + `files` remote form is used: only it can pin `ref` and load several files (and the headers) as one package; the `github://` shorthand is documented in packages/README.md
      `github://sandro-defender/Esphome-Max7219-Matrix-Clock/...` so ESPHome
      downloads it directly from this repository.
- [x] Pin release examples to a version tag; use `@main` only in a clearly
      labelled development example.
- [x] Split the implementation into focused files under `packages/`, including
      base/device, network/API/OTA, display hardware, fonts, renderer/state,
      Home Assistant controls, API actions, diagnostics, and OTA UI.
- [x] Use local `!include` files inside the repository only where ESPHome's
      remote-package resolver is proven to fetch the complete dependency tree.
      Otherwise list every required package file explicitly in the remote
      `files` collection.
- [x] Give every package-owned component a stable, unique `id` so ESPHome's
      package merge behavior is predictable.
- [x] Put safe defaults in `substitutions` and allow the small user YAML to
      override them.
- [x] Expose board, pins, module count, rows, wiring, rotation, flip, device
      names, timezone, update intervals, and feature flags as substitutions
      where compile-time configuration is appropriate.
- [x] Pass credentials from the local YAML as substitutions backed by local
      `!secret` values, because remote packages cannot resolve secrets.
- [x] Never place a credential, private repository token, SSH key, or API key
      in the remote package.
- [x] Add a local development entry point that uses the same package modules
      without needing a GitHub round trip.
- [x] Add automated validation for both the local-development entry point and
      the public remote-package example.
- [x] Document cache refresh behavior and how users pin or upgrade a release.

## Phase 4 — Add repository-hosted fonts and font selection

Font source files and their license files belong in `fonts/`. Release builds
must fetch font files directly from this public repository using ESPHome's web
font source instead of requiring users to copy fonts beside their YAML.

- [x] Add Tiny5 and Press Start 2P source files under `fonts/` with their SIL
      Open Font License files.
- [x] Add Silkscreen Bold to the same pipeline (OFL license kept, measured at
      size 7, selectable, wired into the display lambda, covered by the font
      contract tests and the configurator preview). Matrix Bold and Eight Bit
      Dragon were removed after visual review rejected their clock digits.
- [x] Add 28 additional clock faces and two OFL Georgian faces with their
      source licenses. Noto Sans Georgian and Noto Serif Georgian retain all 33
      modern Mkhedruli and all 33 Mtavruli letters as optional repository
      assets; they are not compiled in the six-font default firmware.
- [x] Reference fonts with explicit `type: web` URLs under
      `https://raw.githubusercontent.com/sandro-defender/Esphome-Max7219-Matrix-Clock/<tag>/fonts/...`.
- [x] Pin production font URLs to the same release tag as the package; do not
      silently mix `main` font assets with a tagged package release.
- [x] Keep a built-in compact 5×7 fallback so the clock remains usable if an
      optional font cannot meet the 48×8 layout.
- [x] Precompile every selectable font at build time; runtime font selection
      must switch between compiled font IDs and must not perform network access.
- [x] Add a Home Assistant `select` entity for clock font.
- [x] Add a separate message-font selector only if flash/RAM measurements show
      ... not added: no safe headroom evidence, so the safer default is one clock-font selector
      safe ESP8266 headroom.
- [x] Limit every external face to clock/status glyphs. Latin message text uses
      the compact built-in fallback; Georgian faces additionally compile both
      modern Georgian alphabets. This keeps the full catalogue within ESP8266
      RAM.
- [x] Use `bpp: 1` unless measurements justify a larger value.
- [x] Verify every font fits full-size `HH:MM:SS`, remains readable at 8 pixels
      ... the five default external faces were measured with ESPHome's own
      monochrome advance math; each is at most 48 px wide and every tallest
      digit is exactly 8 px high; on-panel confirmation remains
      a hardware item
      high, and works with per-digit slide-up animation.
- [x] Test missing glyphs, metrics, clipping, alignment, and fallback behavior.
      ... `test_font_glyphs_cover_every_compiled_character`, `test_font_ink_is_not_taller_than_the_matrix` and `test_every_compiled_font_is_selectable_and_wired` in tests/test_config.py
- [ ] Record firmware-size deltas for each enabled font and remove low-value
      choices if ESP8266 headroom becomes unsafe.
      ... the earlier 33-face build measured 529709 bytes flash and 63200 bytes
      RAM; the default has since been reduced to six exact-8-row choices and
      awaits refreshed aggregate/per-face compile measurements
      if ESP8266 headroom becomes unsafe.
- [x] Document font sources, licenses, raw download URLs, supported glyphs, and
      the steps for adding another font.

### Phase 4a — Web configurator preview parity

- [x] Rasterise the repository fonts for the browser instead of faking faces
      with bitmap stand-ins (`web-configurator/scripts/generate_glyphs.py` →
      `src/glyphs.generated.ts`, driven by `packages/fonts_local.yaml`).
- [x] Mirror the renderer in the preview: same text formats, same
      centring (`box_top`), same fallback chain, same marquee, same seconds bar.
- [x] Remove preview-only fiction (status/temperature screens, split rows, the
      leading-zero and interrupt switches) that the firmware does not have.
- [x] Map every remaining control to a substitution or a restored entity.
- [x] Persist settings in the browser and support shareable, validated links.
- [x] Test the configurator: 42 Vitest checks, including a cross-check that the
      font picker offers exactly the options `packages/controls.yaml` compiles.

## Phase 5 — Make display state explicit

- [x] Define clear modes for Clock, Date, Message, Countdown, OTA, module-grid
      test, and pixel-checkerboard test.
- [x] Give OTA the highest display priority, followed by temporary alerts,
      countdown, and normal screens.
- [x] Keep temporary runtime state out of flash.
- [x] Restore only durable user preferences.
- [x] Keep Home Assistant entity state and internal display state synchronized
      after boot.
- [x] Make expiration calculations safe across `millis()` rollover.
- [x] Provide a readable fallback when Home Assistant time is unavailable.

## Phase 6 — Build the clock renderer

- [x] Render hours, minutes, and seconds with the same 5×7 font.
- [x] Fit full `HH:MM:SS` inside the default 48×8 six-module display.
- [x] Fall back gracefully when the configured matrix is too narrow.
- [x] Support 12-hour and 24-hour modes, including correct midnight/noon and a
      blank leading digit when appropriate.
- [x] Keep clock, date, countdown, message, and test screens within bounds.
- [x] Preserve the seconds progress-bar alternative.
- [x] Clip off-screen animation drawing safely.
- [x] Avoid blocking delays and unnecessary dynamic allocation in the display
      lambda.

## Phase 7 — Add per-digit slide-up animation

- [x] Animate only digits whose value changed.
- [x] Move the old digit upward while the new digit enters from below.
- [x] Keep unchanged digits and separators stationary.
- [x] Make animation non-blocking and rollover-safe.
- [x] Expose animation enable/disable to Home Assistant.
- [x] Expose animation duration or speed when it can be implemented safely.
- [x] Disable ordinary digit animation while OTA status is active.
- [x] Verify transitions at second, minute, hour, day, and 12/24-hour
      boundaries.

## Phase 8 — Expose useful Home Assistant controls

Expose real runtime capabilities only. Keep board type, pins, chip count, row
count, and physical wiring as compile-time substitutions.

### Select entities

- [x] Display mode.
- [x] 12/24-hour format.
- [x] Seconds display mode.
- [x] Clock alignment.
- [x] Date format.
- [x] Animation style, if multiple tested styles exist.
- [x] Message scroll behavior.
- [x] Matrix test pattern.
- [x] Clock font, selecting only from fonts compiled into the firmware.

### Number entities

- [x] Matrix brightness from 0 to 15.
- [x] Animation duration or speed.
- [x] Message scrolling speed.
- [x] Default message duration.
- [x] Countdown duration.
- [x] Automatic screen-cycle interval.
- [x] Day and night brightness.

### Switch entities

- [x] Display power.
- [x] Blinking colon.
- [x] Digit animation.
- [x] Automatic screen cycling.
- [x] Night mode.
- [x] Display inversion only if the official runtime API safely supports it.
- [x] Automatic brightness only when a real light sensor is configured.
      ... not applicable: no light sensor is configured or assumed

### Button entities

- [x] Restart device.
- [x] Return to clock.
- [x] Clear message.
- [x] Start and cancel countdown.
- [x] Run module-grid and pixel tests.
- [x] Restore safe display defaults.

### Diagnostic entities

- [x] Wi-Fi signal, uptime, IP address, connected SSID, ESPHome version, and
      reset reason where officially supported.
- [x] Current display mode.
- [x] Countdown state or remaining time at a network-friendly update rate.
- [x] Free heap or other useful ESP8266 diagnostics only through supported
      components.
- [x] Correct `entity_category`, units, icons, device classes, update intervals,
      restore behavior, and safe defaults.

## Phase 9 — Add parameterized API actions

- [x] Show a scrolling message with validated text and duration.
- [x] Clear the current message.
- [x] Start a countdown with clamped input.
- [x] Cancel the countdown.
- [x] Temporarily show date or status information when useful.
- [x] Add response-enabled status queries only when they provide real value.
- [x] Use `api.respond` only according to ESPHome 2026.9 documentation.
- [x] Handle empty strings, invalid values, overflow, and excessive durations.

## Phase 10 — Show firmware-upload status

Use the native OTA platform's documented `on_begin`, `on_progress`, `on_end`,
and `on_error` automations.

- [x] On start, override every other screen and show `OTA` or `UPDATE`.
- [x] During upload, show a clamped integer percentage from 0 to 100.
- [x] Draw a bottom-row progress bar in addition to the percentage.
- [x] Redraw only when the displayed integer percentage changes.
- [x] On success, show `DONE` or `100%` immediately before reboot.
- [x] On failure, show `ERROR` and the numeric error code when space permits.
- [x] Restore the previous screen and display-power state after an error.
- [x] Keep OTA state temporary and never write progress to flash.
- [x] Expose an OTA-state diagnostic text sensor with `Idle`, `Starting`,
      `Uploading`, `Success`, and `Error` states.
- [x] Optionally expose a percentage sensor, disabled by default and
      rate-limited to meaningful changes.
- [x] Do not rely on the normal display update loop: OTA blocks the application
      loop while uploading.
- [x] Update the MAX7219 immediately from OTA callbacks using a documented,
      non-blocking mechanism verified by compilation and, when possible,
      hardware testing.
      ... generated C++ shows all four triggers wired: on_begin/on_end/on_error
      add UpdateComponentAction<>(matrix), on_progress calls matrix->update()
      only when the integer percentage changes; the transport keeps running
      because each callback just stores a few bytes. Real-upload confirmation
      stays a hardware item.
- [x] Keep every progress callback very short so display feedback cannot break
      the firmware transfer.

## Phase 11 — Add useful clock functions

- [x] Countdown completion message with safe timeout behavior.
- [x] Temporary scrolling notifications from Home Assistant.
- [x] Optional automatic clock/date cycling.
- [x] Configurable day/night brightness schedule.
- [x] Time-synchronization status and fallback display.
- [x] Wiring, orientation, and pixel test modes.
- [x] Do not add integrations for sensors or hardware that are not present.

## Phase 12 — Security and resource review

- [x] Keep every credential behind `!secret` and update
      `secrets.yaml.example` without real values.
- [x] Use encrypted native API and encrypted native OTA.
- [x] Document web-server authentication and network-isolation expectations.
- [x] Avoid exposing unauthenticated firmware upload paths.
- [x] Review generated firmware RAM and flash usage.
      ... ESPHome 2026.9.0 full 33-font build: 529709/1044464 bytes flash
      (50.7%) and 63200/81920 bytes RAM (77.1%)
- [x] Remove or simplify low-value functionality if ESP8266 headroom becomes
      unsafe.
- [x] Avoid rapid diagnostic publishing and excessive API traffic.
- [x] Confirm arrays, positions, digits, durations, and brightness values are
      bounded.

## Phase 13 — Validation tooling

- [x] Keep `tests/test_config.py`, `scripts/validate.ps1`,
      `requirements-validation.txt`, and `VALIDATION.md` current.
- [x] Make the validator use temporary non-production secrets.
- [x] Never read, print, or modify the real `secrets.yaml`.
- [x] Return a failing exit code for every failed test, validation, or compile.
- [x] Clean up only the exact temporary directory created by the validator.
- [x] Support dependency installation, offline reuse, YAML validation, and full
      firmware compilation.
- [x] Run the regression suite.
- [x] Run ESPHome 2026.9.0 `config` validation.
- [x] Run a complete ESP8266 firmware compile.
      ... ESPHome 2026.9.0 linked firmware.bin successfully; flash 48.6%, RAM
      53.7%
- [x] Validate that a clean temporary configuration can fetch all remote package
      YAML and web-font assets without relying on untracked local files.
- [ ] Perform a real OTA upload test when hardware is available and record
      ... no hardware available in the build environment
      whether progress was visible throughout the transfer.

## Phase 14 — Documentation and release

- [x] Update the README with hardware, wiring, secrets, installation, OTA
      migration, Home Assistant controls, actions, validation, and
      troubleshooting.
- [x] Document hardware-dependent limitations and anything not tested on a
      physical matrix.
- [x] Review the staged diff and scan it for secrets.
- [x] Commit one logical, verified increment at a time using conventional commit
      messages.
- [x] Never force-push.
- [x] Push only after tests, configuration validation, and firmware compilation
      pass.
      ... 29 contract tests, 42 configurator tests, ESPHome 2026.9.0 config,
      the offline release path and the full ESP8266 link passed before `main`
      was pushed; no force-push was used
- [x] Confirm local `HEAD` matches the remote `main` branch.

## Definition of done

- [x] All regression tests pass.
- [x] ESPHome 2026.9.0 reports the configuration as valid.
- [x] The full ESP8266 firmware compiles successfully.
- [x] Full-size `HH:MM:SS` fits the default 48×8 matrix.
- [x] Slide-up animation is non-blocking and affects only changed digits.
- [x] OTA start, progress, success, and error screens are implemented.
- [x] Useful runtime settings are exposed cleanly to Home Assistant.
- [x] No credential or generated build artifact is committed.
- [x] Firmware size leaves safe ESP8266 headroom.
      ... 51.4% flash and 46.3% RAM remain free in the validated default build
- [x] Documentation describes the final implementation accurately.
- [x] A minimal example downloads pinned package files and font assets directly
      from the GitHub release without copying the repository locally.
- [x] The final report lists features, entities, API actions, compatibility
      migrations, test results, build size, files changed, commit, push status,
      and remaining hardware-only verification.

## Phase 16 — Reliability, configurator, and release improvements

Work through [tasks/todo.md](tasks/todo.md) in order. The plan deliberately
keeps Home Assistant time primary, treats remote update data as untrusted, and
defines “latest” as the newest immutable published release tag.

- [ ] Fix the per-digit slide-up animation with frame-by-frame renderer tests
      and real-matrix verification.
- [ ] Remove visual gaps between matrices in the web configurator preview
      without changing pixel coordinates or module mapping.
- [ ] Compact the configurator into accessible sections that make future
      settings easier to select.
- [ ] Show the project firmware version briefly at device boot.
- [ ] Add configurable remote SNTP fallback servers, including a Google NTP
      endpoint, used only when Home Assistant time is invalid.
- [ ] Define and test a bounded GitHub release-manifest update check that never
      uploads secrets or performs automatic firmware installation.
- [ ] Make generated public configurations default to the newest published,
      immutable release tag rather than an unpinned branch.
- [ ] Update README documentation, contract tests, ESPHome validation, full
      ESP8266 compile, firmware-size evidence, and hardware verification.
