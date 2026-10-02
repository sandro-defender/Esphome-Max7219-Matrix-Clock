# ESPHome MAX7219 Matrix Clock — current roadmap

## Active continuation — code-only, stepwise PR updates (2026-10-02)

The user has resumed implementation: **work on code, do not try ESPHome builds
or compilation, and update [draft PR #13](https://github.com/sandro-defender/Esphome-Max7219-Matrix-Clock/pull/13)
after each finished step**. Do not invoke the ESPHome CLI (including codegen)
or retry PlatformIO downloads. Source/host/script/web checks remain allowed;
full firmware and physical-device evidence stay unverified. Preserve the
checkpoint below as earlier evidence, not a new build claim.

### Finished step 1 — release publisher safety

- [x] Add **40 offline publisher tests**, with all git/gh/npm commands mocked
  and a subprocess blocker to prevent real publication/network commands.
- [x] Enforce this repository's main push provenance, valid SHA, exact/clean
  checkout, and safe repository/tag/installer identifiers before publishing.
- [x] Verify atomic tag creation/race fallback, collision refusal, annotated
  tags/cycles/depth, bounded pagination and publication-order latest selection.
- [x] Never edit published notes or replace published assets even when GitHub's
  optional immutable lock is off; verify notes/assets before and after publish.
- [x] Resume partial drafts without clobber, re-read create/upload races, reject
  mismatched drafts, use fresh downloads for digest-less assets, and avoid
  mutable-latest promotion on old retries. Do not echo command stderr/secrets.
- [x] Code checks: publisher **40 passed**; source contracts **36 run, 35 passed,
  1 skipped** (exact SDK not installed here); renderer **315 checks passed**;
  web **103 passed**, including 1,044 parity frames; TypeScript **PASS**.
- [ ] Live publishing integration and CI wiring remain separate, unverified work.

### Finished step 2 — code-only continuous validation

- [x] Add `validate-code.yml` on every main push and PR with no path filters,
  read-only permissions, commit-pinned Actions and no persisted checkout token.
- [x] Add `scripts/check_code.py`: exact SDK import dependency/freshness checks,
  host/Python/web/parity/typecheck/web-bundle gates and fail-fast execution.
  It rejects ESPHome/PlatformIO CLI commands; it does not validate/link firmware.
- [x] Add **15 workflow/code-gate contract tests**, including fork safety,
  triggers/permissions, immutable Action refs, full CI coverage and banned CLIs.
- [x] Pin installer `esbuild==0.28.2` explicitly instead of a transitive import.
- [x] Local reduced-coverage code gate passed: **91 Python tests run, 90 passed,
  1 SDK merge test skipped**; **315 host checks**, **103 web tests**, TypeScript,
  production web bundle and diff checks passed. Exact SDK/generated freshness
  were **not rerun locally**; the full CI gate requires the pinned SDK imports.
- [x] Hosted [code-only CI passed](https://github.com/sandro-defender/Esphome-Max7219-Matrix-Clock/actions/runs/36937698635) for source commit `2753a67`:
  full pinned-SDK import/freshness and code gates succeeded. No firmware CLI
  or compilation was run. Local reduced-coverage results remain separately scoped.

### Finished step 3 — guarded release/Pages sequencing in code

- [x] Remove legacy tag-only auto-notes and path-filtered Pages workflows;
  use one dependency chain: checks → publish → matching site → deploy.
- [x] Keep PR/manual/fork runs read-only; only this repository's main push may
  reach publish/site/deploy. Scope write/OIDC permissions to the required job.
- [x] Check out the validated publishing SHA, propagate publisher tag/commit
  outputs and embed `VITE_RELEASE_COMMIT` in the matching static web bundle.
- [x] Add read-only `verify_deployment.py`: verify newest published tag, SHA,
  notes and freshly generated installer bytes; skip superseded publications.
  Recheck immediately before Pages while holding the deployment concurrency lock.
- [x] Pin all Pages Actions to commit SHAs, avoid persisted checkout tokens or
  custom credentials, use retry-specific artifacts and never auto-enable Pages.
- [x] Add **22 deployment/workflow tests** with mocked remote operations. Local
  reduced gate: **113 Python tests run / 112 pass / 1 SDK skip**, **315 host
  checks**, **103 web tests**, typecheck/web bundle/diff checks pass.
- [x] Hosted [code-only CI passed](https://github.com/sandro-defender/Esphome-Max7219-Matrix-Clock/actions/runs/36961874866) for source commit `8418b49`,
  including full pinned-SDK freshness. Main-only publish/site/deploy remain
  unexecuted on this PR; live integration and device sign-off stay unverified.

### Finished step 4 — bounded, fail-closed installer release lookup

- [x] Bound streamed responses by **UTF-8 bytes**, reject oversized declared
  bodies and cancel oversized/unfinished streams. Decode split Unicode safely
  and reject invalid UTF-8 rather than accepting a corrupt metadata response.
- [x] Enforce the deadline even when a fetcher or body ignores AbortSignal;
  preserve anonymous credential-free GETs and the existing no-old-tag fallback.
- [x] Validate publication records/timestamps/IDs, page sizes, tagged repository
  and SDK identity; reject a newest version that differs from the current UI.
  Fail closed instead of silently selecting an older supported release.
- [x] Validate tag-object shapes and stop cyclic annotated tags early, retaining
  the bounded dereference and publishing-SHA gate.
- [x] Add **13 release-response regressions** (22 resolver tests total). Local
  reduced gate: **116 web tests**, **315 host checks**, **113 Python tests run /
  112 pass / 1 SDK skip**, typecheck, web bundle and diff checks pass.
- [ ] Observe hosted CI for step 4. No ESPHome CLI, release publication, Pages
  deployment, browser automation or production-secret access was performed.

### Next finished-step targets

- [ ] Extend stateful preview parity beyond the current 1,044-frame oracle.
- [ ] Safely migrate legacy validator entry points without running firmware CLI.
- [ ] Refresh current release-note metadata and validate live release/installer/
  Pages behavior when publication is explicitly approved. Firmware/hardware
  verification remains deferred; do not mark source wiring as live deployment.

## Earlier checkpoint — 2026-10-02

**Status: implementation checkpoint for a draft PR, not a completed release.**
The current candidate is `0.7.0` (unreleased), targeting **ESPHome 2026.9.1
exactly**, on `arena/01a0f913-esphome-max7219-matrix-clock`, based on
`e693db49da8c09ae6f41c16dc2d9a5c0d0c93f3b`.

The earlier instruction was to finish the checkpoint, record the work and
remaining steps, and push a PR. That checkpoint was completed; the active
code-only continuation above supersedes its pause in implementation. The sections below are the
current acceptance checklist; older checked phases are preserved separately
as history and are **not evidence that this candidate is ready to merge**.

### 1. Implemented and locally verified in this increment

- [x] Keep focused firmware modules under `packages/` and small entry YAMLs.
- [x] Pin firmware and validation tooling to ESPHome **2026.9.1**; inspect its
  official tagged font, MAX7219, package merge, StringRef and OTA behavior.
- [x] Compile exactly **Pixel Clock 6×8 + Matrix 2px** in default local/remote
  builds and the configurator. Compact 5×7 is built in; extra compatible faces
  are opt-in without an artificial selection cap. All-font builds are separate.
- [x] Repair Matrix 2px zero's upper-left 2×2 stroke without redesigning the face.
- [x] Implement 20 ms changed-digit-only slides with per-cell ink clipping,
  duration/row-gap controls, cancellation on font/layout/disable changes and
  history reset after overlays. Keep unchanged digits and separators stationary.
- [x] Add the installed version boot screen and native OTA start/progress/bar,
  success/error rendering, with synchronous driver flush during the blocked
  loop, actual 0–100% progress and temporary brightness/power overrides.
  **Physical-device verification is still required.**
- [x] Generate defaults, controls/ranges/options, 48 entities, 6 actions, modules,
  font metadata, reset actions, example YAMLs and web metadata from firmware.
  Metadata bindings supply labels/hints, not duplicate defaults or options.
- [x] Keep Configure limited to controls/live preview; move documentation,
  hardware, font details, installation, entity reference and notes to Info & Help.
- [x] Implement anonymous, bounded newest-published-release resolution with
  immutable-tag/commit/contract/notes checks and fail-closed installer gating.
  Recheck immediately before copying/downloading; never export an unpinned ref.
- [x] Add independent browser masks and an official tagged packed-glyph/writer/
  SPI host oracle; compare 1,044 frames plus stationary-cell assertions.
- [x] Migrate Python source-contract expectations to the current default pair,
  generated package/ref/reset ownership and explicit verified installer tags.
- [x] Exercise the new isolated validator on default/all/built-in firmware and
  default/custom-all-font browser installer YAML, using only fake secrets.
- [x] Record accurate current results and separate historical size/build evidence.

### 2. Checkpoint validation evidence

| Gate | Result for this increment |
| --- | --- |
| Pure C++ renderer | **315 checks, 0 failures** |
| Python contracts | **36 tests, OK, no skips**; exact tagged merge over all 32 font subsets |
| Configurator | **103 tests passed**, including 9 oracle/parity tests |
| Pixel oracle | **1,044 C++/browser frames compared** |
| TypeScript | **PASS**, `tsc --noEmit` |
| Production web build | **PASS**, single-file Vite output |
| Generated contract/glyph freshness | **PASS**, checked artifacts match sources |
| ESPHome 2026.9.1 YAML + C++ generation | **PASS**, five isolated variants |
| Full ESP8266 link | **BLOCKED** by PlatformIO registry/toolchain TLS EOF/HTTPClientError; no current binary/size result |
| Physical device / deployment | **NOT RUN** |

Commands and scope are in [VALIDATION.md](VALIDATION.md). The full compile
failure happened during toolchain acquisition, not a firmware compiler diagnostic.
Code generation and host tests do **not** substitute for a full ESP8266 build.

### 3. Next increment — automated immutable release and matching Pages

Source wiring is implemented in steps 1–3. Actual main publication, Pages
integration and live installer checks below are not claimed or executed yet.
The automation publishes source/YAML installers, not compiled firmware binaries.

- [x] Define exact SDK/font-generation dependency installation and non-mutating
  generated freshness checks in code-only CI (step 2); hosted code-only run passed for `2753a67`.
- [x] Replace path-filtered/tag-only legacy workflows with every-main/PR
  code-only validation and strictly main-only publication/deployment jobs (step 3).
- [x] Wire C++/Python/web/typecheck/web-build/parity and generated freshness
  into code-only CI (step 2). ESPHome CLI/codegen/full builds are deferred by
  the user and are not prerequisites to each source-only PR update.
- [x] Audit and unit-test `scripts/publish_release.py`: main-only provenance,
  tag reservation/collisions, draft assets/retries, idempotency, immutable
  publication and publication-order selection — 40 offline tests in step 1.
  Workflow permissions/wiring are tested in step 3; actual publication is unverified.
- [ ] After validation, publish an appropriate immutable versioned release
  (`VERSION`, or `VERSION+12hexSHA` for later commits at that version), with
  matching notes, commit and installer asset. Never move existing tags.
- [ ] Deploy Pages from the same validated commit **after** successful release
  publication, including injected build SHA and least-privilege permissions.
- [ ] Verify the live installer resolves the newest published immutable tag and
  the tagged contract/assets actually fetch; test annotated tags, pagination,
  malformed/offline/rate-limited responses, deployment lag and repeat runs.
- [ ] Migrate the legacy PowerShell/offline release validators safely. In
  particular, the legacy offline shell validator copies the whole checkout;
  do not use it with a production `secrets.yaml` present.

### 4. Build, parity edge cases and hardware sign-off

- [ ] Re-run full default/all-font ESP8266 compilation where the PlatformIO
  toolchain can be downloaded; record exact commit, toolchain and flash/RAM
  deltas/headroom. Historical 0.4.0 measurements are not candidate measurements.
- [ ] Complete stateful timeline parity for auto-cycle, countdown/alert/message
  interactions and interrupted overlays, beyond the checked static/frame oracle.
- [ ] Verify a physical 48×8 panel: default font readability, repaired zero,
  changed-digit-only motion, midnight/hour rollover, speed/gap extremes and
  narrow/multi-row/rotation/flip mappings.
- [ ] Verify installed tag splash then preference restoration on a real boot.
- [ ] Exercise encrypted OTA while the normal loop is blocked: visible start,
  percentage/bar, 100% completion, error/code and restoration; also test
  display-off, inversion, zero brightness and night/alarm settings.
- [ ] Manually check keyboard labels/access, reduced motion and small-screen
  layout. No browser automation is requested or used.
- [ ] Record final live release tag, commit, deployment status and hardware
  results; only then mark the PR ready to merge/release.

### 5. This checkpoint hand-off

- [x] Finish available local checks and document blockers honestly.
- [x] Update this roadmap, report, validation notes and current task list.
- [x] Commit/push the existing Arena branch and open **[draft PR #13](https://github.com/sandro-defender/Esphome-Max7219-Matrix-Clock/pull/13)**
  to `main`. Implementation checkpoint: `bac63dc462f54b9b4ff0118eeac80c1c34aaae75`.
  No `main` push, tag/release publication or Pages deployment was performed.

## Archived roadmap — earlier releases and prior backlog

The following is the original roadmap at base commit `e693db4`, including
historical ESPHome 2026.9.0 evidence and old font policies. It is retained for
traceability; current targeting/defaults/results are defined above. In particular,
its checked definition-of-done/build/push items apply to earlier releases only.

## ESPHome 2026.9 MAX7219 Clock Roadmap

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

### Phase 0 — Protect existing work

- [x] Read `AGENTS.md`, this roadmap, the README, YAML, tests, scripts, and
      current Git diff.
- [x] Identify which files are committed, staged, modified, and untracked.
- [x] Preserve existing user work and avoid broad cleanup or destructive Git
      commands.
- [x] Confirm the active board, module count, rows, wiring pattern, rotation,
      and pins from the configuration rather than guessing.
- [x] Scan tracked and staged content for embedded credentials.
- [x] Keep `secrets.yaml`, build output, and validation environments ignored.

### Phase 1 — Establish tests and compatibility rules

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

### Phase 2 — Migrate cleanly to ESPHome 2026.9.0

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

### Phase 3 — Split the configuration into remote packages

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

### Phase 4 — Add repository-hosted fonts and font selection

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

#### Phase 4a — Web configurator preview parity

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

### Phase 5 — Make display state explicit

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

### Phase 6 — Build the clock renderer

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

### Phase 7 — Add per-digit slide-up animation

- [x] Animate only digits whose value changed.
- [x] Move the old digit upward while the new digit enters from below.
- [x] Keep unchanged digits and separators stationary.
- [x] Make animation non-blocking and rollover-safe.
- [x] Expose animation enable/disable to Home Assistant.
- [x] Expose animation duration or speed when it can be implemented safely.
- [x] Disable ordinary digit animation while OTA status is active.
- [x] Verify transitions at second, minute, hour, day, and 12/24-hour
      boundaries.

### Phase 8 — Expose useful Home Assistant controls

Expose real runtime capabilities only. Keep board type, pins, chip count, row
count, and physical wiring as compile-time substitutions.

#### Select entities

- [x] Display mode.
- [x] 12/24-hour format.
- [x] Seconds display mode.
- [x] Clock alignment.
- [x] Date format.
- [x] Animation style, if multiple tested styles exist.
- [x] Message scroll behavior.
- [x] Matrix test pattern.
- [x] Clock font, selecting only from fonts compiled into the firmware.

#### Number entities

- [x] Matrix brightness from 0 to 15.
- [x] Animation duration or speed.
- [x] Message scrolling speed.
- [x] Default message duration.
- [x] Countdown duration.
- [x] Automatic screen-cycle interval.
- [x] Day and night brightness.

#### Switch entities

- [x] Display power.
- [x] Blinking colon.
- [x] Digit animation.
- [x] Automatic screen cycling.
- [x] Night mode.
- [x] Display inversion only if the official runtime API safely supports it.
- [x] Automatic brightness only when a real light sensor is configured.
      ... not applicable: no light sensor is configured or assumed

#### Button entities

- [x] Restart device.
- [x] Return to clock.
- [x] Clear message.
- [x] Start and cancel countdown.
- [x] Run module-grid and pixel tests.
- [x] Restore safe display defaults.

#### Diagnostic entities

- [x] Wi-Fi signal, uptime, IP address, connected SSID, ESPHome version, and
      reset reason where officially supported.
- [x] Current display mode.
- [x] Countdown state or remaining time at a network-friendly update rate.
- [x] Free heap or other useful ESP8266 diagnostics only through supported
      components.
- [x] Correct `entity_category`, units, icons, device classes, update intervals,
      restore behavior, and safe defaults.

### Phase 9 — Add parameterized API actions

- [x] Show a scrolling message with validated text and duration.
- [x] Clear the current message.
- [x] Start a countdown with clamped input.
- [x] Cancel the countdown.
- [x] Temporarily show date or status information when useful.
- [x] Add response-enabled status queries only when they provide real value.
- [x] Use `api.respond` only according to ESPHome 2026.9 documentation.
- [x] Handle empty strings, invalid values, overflow, and excessive durations.

### Phase 10 — Show firmware-upload status

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

### Phase 11 — Add useful clock functions

- [x] Countdown completion message with safe timeout behavior.
- [x] Temporary scrolling notifications from Home Assistant.
- [x] Optional automatic clock/date cycling.
- [x] Configurable day/night brightness schedule.
- [x] Time-synchronization status and fallback display.
- [x] Wiring, orientation, and pixel test modes.
- [x] Do not add integrations for sensors or hardware that are not present.

### Phase 12 — Security and resource review

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

### Phase 13 — Validation tooling

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

### Phase 14 — Documentation and release

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

### Definition of done

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

### Phase 16 — Reliability, configurator, and release improvements

Work through [tasks/todo.md](tasks/todo.md) in order. The plan deliberately
keeps Home Assistant time primary, treats remote update data as untrusted, and
defines “latest” as the newest immutable published release tag.

- [ ] Fix the per-digit slide-up animation with frame-by-frame renderer tests
      and real-matrix verification.
- [x] Remove visual gaps between matrices in the web configurator preview
      without changing pixel coordinates or module mapping.
      ... `MatrixCanvas` joins the boards edge to edge (`gap = 0`); the optional
      dashed seam guides are drawn as a read-only overlay, and 15 boundary
      tests assert the seam geometry of 1×1 … 16×4 panels
- [ ] Compact the configurator into accessible sections that make future
      settings easier to select.
      ... native Tune disclosures and static-render coverage added (61 web
      tests pass); keyboard/small-screen browser verification remains open.
- [ ] Show the project firmware version briefly at device boot.
- [ ] Add configurable remote SNTP fallback servers, including a Google NTP
      endpoint, used only when Home Assistant time is invalid.
- [ ] Define and test a bounded GitHub release-manifest update check that never
      uploads secrets or performs automatic firmware installation.
- [ ] Make generated public configurations default to the newest published,
      immutable release tag rather than an unpinned branch.
- [ ] Update README documentation, contract tests, ESPHome validation, full
      ESP8266 compile, firmware-size evidence, and hardware verification.

#### Staged font-inclusion increment

- [x] Add per-face release packages and Tune selection (Matrix 2px + Dot Matrix,
      up to three extras), persistence and hostile-link clamping.
- [x] Keep local measurement catalogue and glyph pipeline synchronized; test
      subset option/wiring parity, including built-in only and all faces.
- [ ] Exact ESPHome 2026.9.0 config + full builds, flash/RAM deltas, physical
      matrix and browser keyboard/mobile verification for the new implementation.
      _(Exact ESPHome 2026.9.0 config + full ESP8266 builds and flash/RAM deltas
      completed on Python 3.12.7: default two-face build uses 505,141 B / 48.4%
      flash and 41,276 B / 50.4% RAM; physical matrix and browser keyboard/mobile
      verification remain open — see `VALIDATION.md`.)_
- [x] Publish compatible immutable release and enable installer export; tag and
      GitHub release `0.4.0` published at validated commit
      `7c85cc49ec9c01c08adc26be9b2905ed85b9bd96`, verified via clean remote
      `esphome config` fetch of `https://github.com/sandro-defender/Esphome-Max7219-Matrix-Clock@0.4.0`,
      `INSTALLER_READY = true` enabled, draft warnings removed, and gate tests
      updated.
