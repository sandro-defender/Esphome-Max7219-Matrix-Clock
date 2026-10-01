# Final report - modular MAX7219 clock (ESPHome 2026.9.0)

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

## 1. Features

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

## 2. Home Assistant entities

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

## 3. API actions

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

## 4. Compatibility migrations (from firmware v2.0)

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

## 5. Test and validation results

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

## 6. Build size

The validated ESPHome 2026.9.0 default build uses **529709 of 1044464 bytes of
flash (50.7%)** and **63200 of 81920 bytes of RAM (77.1%)**. That leaves 49.3%
flash and 22.9% RAM headroom with all 33 repository fonts compiled. The
roadmap still leaves per-font differential measurement as optional follow-up;
the aggregate production configuration is measured and safe.

## 7. Files changed

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

## 8. Commit and push status

The expanded font catalogue is prepared for `main` and release tag `0.2.0`.
The tests, ESPHome 2026.9.0 configuration validation, full ESP8266 compile and
emulated `0.2.0` release path must pass before publication.
`examples/release.yaml`, `packages/base.yaml`, `packages/fonts_web.yaml` and the
configurator pin the same version, enforced by the contract tests.

No force-push was used at any point.

## 9. Remaining hardware-only verification

1. On-panel readability of Silkscreen Bold (size 7), Tiny5 (size 10) and Press
   Start 2P (size 6).
2. OTA upload with a real device: confirm the progress screen redraws from the
   OTA callbacks (`id(matrix).update()`).
3. Wiring/orientation confirmation with the module-grid and pixel tests.
4. Behaviour of the physical controls (display power, inversion, night
   brightness, 12/24-hour and date formats).

## 10. Deviations and open items

* Two roadmap checkboxes remain unchecked: optional per-font size deltas and
  the real-device OTA upload test.
* The release example uses the explicit remote-package form (`url` + `ref` +
  `files`) instead of the `github://` shorthand, because only the explicit form
  can pin a tag and load several files (including the two C++ headers) as one
  package. `github://` remains documented in `packages/README.md`.
* A separate message-font selector was deliberately not added because it would
  duplicate the clock-font setting without adding useful capability.
