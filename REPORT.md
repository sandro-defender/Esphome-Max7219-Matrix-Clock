# Implementation checkpoint report

## Code-only continuation — 2026-10-02

This continuation stayed **code-only**: no ESPHome/PlatformIO CLI, firmware
config/codegen/build, live release/deployment, browser automation or production
secrets access. Arena fixes the current session to
`arena/01a0fb1d-esphome-max7219-matrix-clock`; existing draft PR #13 still has
head `arena/01a0f913-esphome-max7219-matrix-clock` at `5adcc9a`. This checkout
was recreated from base in the new turn; the preserved staged tree was verified
to equal that checkpoint plus the step-5 delta before restoring history. Git/
`gh` authentication had failed in the prior turn but is now restored. The user
has requested a PR from the assigned branch; PR #13 remains untouched and must
not be described as containing step 5.

Step 1 hardens the publisher and adds **40 mocked unit tests**: main-push/clean-
checkout provenance; atomic tag races/collisions; annotated-tag bounds;
publication-order pagination; immutable published notes/assets; non-clobbering
draft recovery; pre/post publication verification and safe error reporting. No
real release was created. Step 2 adds read-only every-main/PR code-only CI with
pinned Actions, a fail-fast runner, 15 workflow/code-gate tests and an explicit
esbuild dependency. Step 3 wires guarded main-only release → same-SHA Pages;
actual publication/deployment remains unverified. Step 4 hardens installer
release lookup with streamed byte limits, deadlines, strict identity/version
checks and tag-cycle detection. Hosted [run 36965718848](https://github.com/sandro-defender/Esphome-Max7219-Matrix-Clock/actions/runs/36965718848)
passed source/preview checks for `dd1037f`; publish/site/deploy were skipped.

### Step 3: main-only release → matching Pages source wiring

One workflow now gates publication after code checks, builds from the validated
publishing commit, injects that SHA, and deploys only after release/notes/installer
verification. A read-only guard skips superseded publications and rechecks while
holding the Pages lock. Permissions, Actions, artifact retries and main/fork/PR
boundaries are covered by 22 new mocked tests. No live publishing/deployment or
ESPHome CLI was executed. Reduced checks: 113 Python tests (112 pass, 1 SDK skip),
315 host checks, 103 web tests, typecheck/web bundle passed. Hosted [code-only CI](https://github.com/sandro-defender/Esphome-Max7219-Matrix-Clock/actions/runs/36961874866)
passed for `8418b49`, including full SDK freshness. Actual main integration
remains unverified. [RELEASING.md](RELEASING.md) documents
this source/YAML release pipeline and the still-deferred firmware/device gates.

### Step 4: bounded, fail-closed installer release lookup

Stream responses with a UTF-8 byte cap and deadline/cancellation, including a
fetcher/body that ignores AbortSignal. Validate publication records, version,
repository/SDK identity and tag-object shapes; reject cycles and malformed input
without installing an older supported tag. Add 13 mocked release regressions
(22 resolver tests). The hosted `dd1037f` run above passed checks; privileged
publication/site/deployment jobs were skipped.

### Step 5: stateful native/browser preview parity (normal screens + messages)

The host fixture now accepts sequential frames/events while retaining the actual
C++ `Runtime`. It applies `Report.mode`/`Report.screen_changed` after drawing,
so an automatic screen update first appears on the next frame. Screen and other
writer preferences are still mapped through generated `tests/frame.generated.h`.
The browser `usePreview` owns one `PreviewTimeline`, samples `performance.now()`
for runtime state, keeps civil clock/timezone separate, and passes the same
immutable timeline snapshot through settled and animated draws. The timeline is
idempotent for a repeated logical frame.

The stateful contract matches the actual renderer's one-second housekeeping,
uint32 rollover/deadlines, single toggle on a late frame, cycle-timer retention
while messages block cycling, post-render report feedback, immediate visual
message expiry, and housekeeping-only queue clearing. It does not restart an
active message deadline when only the default-duration setting changes.

Local reduced code-only gate passed **113 Python tests run / 112 passed / 1
exact-SDK skip**, **315 host checks**, **125 web tests**, TypeScript, production
web bundle and diff checks. Nine timeline tests compare **47 sequential native
and browser frames**, including visible pixels, page/mode, brightness, report
screens and runtime timers. Exact SDK imports/generated freshness were not run
locally; hosted [run 36975692611](https://github.com/sandro-defender/Esphome-Max7219-Matrix-Clock/actions/runs/36975692611)
passed for `77cf9ec`, including pinned-SDK/source-freshness checks. Publish/site/
deployment jobs were skipped. Countdown/alert/boot/OTA retained timelines,
firmware compilation, physical-device checks and live publication/deployment
remain unverified.

## Earlier draft checkpoint — 2026-10-02

- **Candidate:** `0.7.1` (workflow-published after merge); exact target ESPHome **2026.9.1**.
- **Branch:** `arena/01a0f913-esphome-max7219-matrix-clock`.
- **Base commit:** `e693db49da8c09ae6f41c16dc2d9a5c0d0c93f3b`.
- **Disposition:** checkpoint this work and open a draft PR. This is not a
  completed implementation, firmware release or Pages deployment. The final
  implementation checkpoint is `bac63dc462f54b9b4ff0118eeac80c1c34aaae75`;
  **[draft PR #13](https://github.com/sandro-defender/Esphome-Max7219-Matrix-Clock/pull/13)** is open. Its current head (including this hand-off
  documentation) is recorded in the PR description.

### Delivered source changes

1. Default Pixel Clock 6×8 + Matrix 2px packages, separate all-font measurement
   catalogue, unlimited optional extra selection and built-in Compact 5×7.
   Matrix zero's missing upper-left 2×2 stroke is repaired.
2. Per-cell clipped changed-digit slides, 20 ms sampling, duration/gap controls,
   font/layout/disable cancellation and overlay lifecycle reset.
3. Installed-version boot screen; secure native OTA callbacks with actual
   percentage, progress bar, synchronous MAX7219 transmission and temporary
   visibility overrides. Real boot/OTA confirmation remains hardware-only.
4. Firmware-derived contract for 44 settings, 48 entities and 6 actions, defaults,
   packages, fonts, reset actions, release notes, examples and web metadata.
5. Controls/live-preview Configure page and separate Info & Help; schema-driven
   installer YAML with local `!secret` references only. No production secrets
   were read/copied; no credentials are stored in links/preferences or sent to
   GitHub by the release lookup.
6. Bounded anonymous newest-published-release verification, immutable tagged
   source/commit/notes checks, staleness gate and recheck before installer export.
   This candidate UI deliberately fails closed against older releases without
   the generated contract; publication/deployment remains follow-up work.
7. Tagged ESPHome packed-glyph, API, MAX7219 writer and SPI oracle, 1,044 pixel
   comparisons, updated regression tests and isolated five-variant validator.
8. Preparatory installer CLI and release publisher. The publisher has not been
   run to publish anything and still needs audit/tests/CI wiring.

### Current validation

| Check | Result |
| --- | --- |
| C++ renderer | **315 checks, 0 failures** |
| Python source contracts | **36 tests, OK, no skips** |
| Web tests | **103 passed**; 1,044 oracle frames in 9 parity tests |
| TypeScript and production Vite build | **PASS** |
| Generated firmware/glyph freshness | **PASS** |
| Exact ESPHome 2026.9.1 config + code generation | **PASS** for default, all-font, built-in-only and two browser-installer profiles |
| Full ESP8266 compile | **BLOCKED**: PlatformIO registry/toolchain TLS EOF/HTTPClientError |
| Current flash/RAM, physical boot/OTA, live release/Pages | **NOT VERIFIED** |

See [VALIDATION.md](VALIDATION.md) for commands. No current linked firmware
exists, so the archived binary sizes below must not be attributed to this
candidate or ESPHome 2026.9.1.

### Remaining work / merge gates

[ROADMAP.md](ROADMAP.md) is authoritative. Remaining: hosted code-only check for
step 5; retained countdown/alert/boot/OTA timeline coverage; safe legacy
validator migration; live immutable release/installer/Pages integration when
approved; current firmware builds/size evidence; and manual accessibility and
real-panel boot/animation/encrypted-OTA checks. The release/Pages workflow source
is implemented and code-tested, but no publication or deployment occurred.

This session's branch restriction prevents step 5 from being attached to PR #13,
whose source branch remains the prior handoff branch. No new PR, tag, release or
Pages deployment was created.

## Historical reports — unchanged evidence from the base commit

The archived report below refers to older 0.2.0/0.4.0 releases and their original
ESPHome 2026.9.0 validation. It preserves prior measurements and completion
claims, not current verification. Its old fonts, installer gate and release
references are historical, superseded by the current draft above.

## Final report - modular MAX7219 clock (ESPHome 2026.9.0)

Validated historical baseline: **0.2.0** (sections 1–10 below preserve that
initial modularization report). Release **0.4.0** (later releases keep the same
package layout; the current version is in `packages/base.yaml`), whose
default two-face configuration (`Matrix 2px` + `Dot Matrix` + built-in
`Compact 5x7`) and optional subsets have been validated and compiled with
ESPHome `2026.9.0` on Python 3.12.7 (`505,141 / 1,044,464 B` flash `48.4%`,
`41,276 / 81,920 B` RAM `50.4%`), verified via `scripts/validate-release-offline.sh 0.4.0`
and live remote fetch of `https://github.com/sandro-defender/Esphome-Max7219-Matrix-Clock@0.4.0`,
and published as immutable tag/release `0.4.0` with `INSTALLER_READY = true`;
see [`VALIDATION.md`](VALIDATION.md) and
[`packages/fonts/README.md`](packages/fonts/README.md) for current `0.4.0`
measurements and status.

Scope: replace the single-file `max7219-clock.yaml` with the modular package
layout from `ROADMAP.md`, add the renderer/state machine with fonts, animation,
countdown and OTA screens, expose the full Home Assistant surface, and add the
validation tooling. Every claim below refers to an artifact in this repository
or to a command that was actually executed.

### 1. Features

* **Screens and modes**: clock, date, message, countdown, OTA, module-grid test,
  pixel-checkerboard test. Priority: OTA > alert/message > countdown > selected
  screen.
* **Full numeric clock in the default 48×8 layout**: every external face is
  measured with worst-case `88:88:88`; all 33 fit within 48 pixels.
* **Fonts**: 33 bundled fonts (`fonts/`, OFL licensed) downloaded at build time,
  including Noto Sans Georgian and Noto Serif Georgian with Mkhedruli and Mtavruli,
  from a tag-pinned raw GitHub URL, restricted glyph sets, `bpp: 1`, plus a
  built-in fallback font that needs nothing and always fits. Runtime font
  selection switches between compiled font IDs only. The web configurator
  rasterises the same files, so its preview shows the real glyphs.
* **Per-digit slide-up animation**: only changed digits move, old digit slides
  up while the new one enters from below, non-blocking, `millis()`-rollover
  safe, disabled during OTA, switchable from Home Assistant.
* **Messages/alerts**: bounded (47/23 chars), upper-cased, scrolling or static,
  with durations.
* **Countdown**: 1 s - 59:59, clamped, completion notice.
* **Day/night brightness**: manual night mode or hour schedule.
* **Automatic clock/date cycling** with configurable interval.
* **OTA feedback**: `OTA` → percentage + bottom-row bar → `100%` → `ERROR <code>`
  with restore of the previous screen/power state; percentage redraw happens only
  when the integer changes.
* **Diagnostics**: display mode, OTA state, countdown remaining, OTA percent
  (disabled by default), Wi-Fi signal, IP, SSID, uptime, heap stats, version,
  reset reason, status.

### 2. Home Assistant entities

| Platform | Count | Names |
|---|---|---|
| select | 7 | Screen, Clock alignment, Time format, Seconds display, Date format, Clock font, Message scroll |
| number | 9 | Matrix brightness, Night brightness, Animation duration, Message scroll speed, Default message duration, Countdown duration, Screen cycle interval, Night start hour, Night end hour |
| switch | 7 | Matrix display, Blinking colon, Digit animation, Automatic screen cycling, Night mode, Night schedule, Display inversion |
| button | 8 | Restart device, Return to clock, Clear message, Start countdown, Cancel countdown, Run module grid test, Run pixel test, Restore display defaults |
| diagnostic | 15 | Display mode, OTA state, Countdown remaining, OTA percent, Wi-Fi signal, Uptime, Free heap, Largest free block, Heap fragmentation, ESPHome version, IP address, Connected SSID, Reset reason, Device info, Status |

All controls are `entity_category: config`, all diagnostics are
`entity_category: diagnostic` and publish on change or once a minute, enforced
by `tests/test_config.py`.

### 3. API actions

| Action | Variables | Notes |
|---|---|---|
| `show_message` | `message: string`, `duration: int` | upper-cased, ≤ 47 chars, trimmed, duration clamped to 0-3600 s (0 = default duration entity) |
| `clear_message` | - | also resets the Screen select to Clock |
| `start_countdown` | `seconds: int` | clamped to 1-3599 |
| `cancel_countdown` | - | |
| `show_status` | `note: string`, `duration: int` | static alert, ≤ 23 chars |
| `get_status` | - | `api.respond` with data: mode, screen, OTA state, countdown, free heap, uptime |

Action metadata is kept short on purpose: ESP8266 allows at most 384 bytes of
name/variable/description/example text per action, checked by the test suite.

### 4. Compatibility migrations (from firmware v2.0)

| v2.0 | Now |
|---|---|
| `api: services:` | `api: actions:` (names `show_message`/`clear_message` unchanged) |
| `ota: - platform: esphome` (unencrypted) | encrypted native OTA reusing the API key |
| `web_server: version: 3` (no auth, OTA enabled) | optional module: auth required, `ota: false`, `version: 2` |
| hard-coded `esp8266: board: d1_mini` plus unused `esp8266_board` substitution | single `${board}` substitution (default `d1_mini`) |
| HA entities: Screen, Clock alignment, Time format, Seconds display, Matrix brightness, Matrix display, Blinking colon | same names/ids, extended with new entities |
| `time: homeassistant` only | Home Assistant + SNTP fallback |
| on-screen fonts: fixed tiny/large bitmaps in the lambda | renderer with selectable fonts and fallback |
| no `min_version`, no project metadata | `min_version: "2026.9.0"` + project name/version |
| legacy `esphome_Max7219-Matrix-Clock/max7219-clock.yaml` | removed from the tree (kept in git history), replaced by `dev.yaml`, `examples/*` and `packages/*` |

No OTA password existed in v2.0, so the two-step OTA password migration does not
apply; the documented ESPHome migration still applies to older setups.

### 5. Test and validation results

| Check | Command | Result |
|---|---|---|
| Contract tests | `python tests/test_config.py` | 29 tests, **OK** (host-only C++ case skipped because no host compiler is installed) |
| Renderer unit tests | `make -C tests test` | **179 checks, 0 failures** |
| ESPHome config validation | `esphome config dev.yaml` (2026.9.0) | **`INFO Configuration is valid!`** |
| C++ code generation | `esphome compile dev.yaml` | headers included, all 33 fonts instantiated, display writer wired, all actions and OTA callbacks emitted |
| Released example fetched from **real GitHub** (`ref:` = pushed branch) | `INFO Cloning https://github.com/sandro-defender/Esphome-Max7219-Matrix-Clock@...`, **`INFO Configuration is valid!`**, `main.cpp` generated (2955 lines), headers copied into the build `src/` |
| OTA screens in the generated C++ | `UpdateComponentAction<>(matrix)` on `on_begin`/`on_end`/`on_error`, `matrix->update()` inside `on_progress` (only when the percentage changes) |
| Release path (offline) | `scripts/validate-release-offline.sh 0.2.0` | packages cloned from a tagged git repository and all 33 web fonts downloaded |
| Font width measurements | freetype with ESPHome's advance math | all 33 external faces fit worst-case `88:88:88` at ≤48 px |
| Configurator | `cd web-configurator && npm test && npm run typecheck && npm run build` | 43 tests, type-check clean, single-file build 347.79 kB (102.93 kB gzip) |
| **Full firmware compile** | `scripts/validate.ps1` with ESPHome 2026.9.0 | **PASS** - firmware linked successfully |

### 6. Build size

The validated ESPHome 2026.9.0 default build uses **529709 of 1044464 bytes of
flash (50.7%)** and **63200 of 81920 bytes of RAM (77.1%)**. That leaves 49.3%
flash and 22.9% RAM headroom with all 33 repository fonts compiled. The
roadmap still leaves per-font differential measurement as optional follow-up;
the aggregate production configuration is measured and safe.

### 7. Files changed

Added: `packages/` (11 modules + 2 C++ headers + README),
`examples/release.yaml`, `examples/development.yaml`, `dev.yaml`,
`secrets.yaml.example` (moved to the root and extended),
`tests/test_config.py`, `tests/test_renderer.cpp`, `tests/Makefile`,
`scripts/validate.ps1`, `scripts/validate-release-offline.sh`,
`requirements-validation.txt`, `VALIDATION.md`, `REPORT.md`.

Updated: `README.md` (complete rewrite for the package layout),
`fonts/README.md` (measurements, glyph sets, add-a-font steps), `ROADMAP.md`
(checkboxes with evidence), `.gitignore`
(`__pycache__/`, `.venv/`, `validation-tmp/`).

Removed: `esphome_Max7219-Matrix-Clock/max7219-clock.yaml` and its
`secrets.yaml.example` (superseded; the history keeps the v2.0 firmware).

### 8. Commit and push status

The expanded font catalogue is prepared for `main` and release tag `0.2.0`.
The tests, ESPHome 2026.9.0 configuration validation, full ESP8266 compile and
emulated `0.2.0` release path must pass before publication.
`examples/release.yaml`, `packages/base.yaml`, `packages/fonts_web.yaml` and the
configurator pin the same version, enforced by the contract tests.

No force-push was used at any point.

### 9. Remaining hardware-only verification

1. On-panel readability of Silkscreen Bold (size 7), Tiny5 (size 10) and Press
   Start 2P (size 6).
2. OTA upload with a real device: confirm the progress screen redraws from the
   OTA callbacks (`id(matrix).update()`).
3. Wiring/orientation confirmation with the module-grid and pixel tests.
4. Behaviour of the physical controls (display power, inversion, night
   brightness, 12/24-hour and date formats).

### 10. Deviations and open items

* Two roadmap checkboxes remain unchecked: optional per-font size deltas and
  the real-device OTA upload test.
* The release example uses the explicit remote-package form (`url` + `ref` +
  `files`) instead of the `github://` shorthand, because only the explicit form
  can pin a tag and load several files (including the two C++ headers) as one
  package. `github://` remains documented in `packages/README.md`.
* A separate message-font selector was deliberately not added because it would
  duplicate the clock-font setting without adding useful capability.
