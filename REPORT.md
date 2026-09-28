# Final report - modular MAX7219 clock (ESPHome 2026.9.0)

Release: **0.1.2** (pinned consistently in `examples/release.yaml`,
`packages/base.yaml` and `packages/fonts_web.yaml`).

Scope: replace the single-file `max7219-clock.yaml` with the modular package
layout from `ROADMAP.md`, add the renderer/state machine with fonts, animation,
countdown and OTA screens, expose the full Home Assistant surface, and add the
validation tooling. Every claim below refers to an artifact in this repository
or to a command that was actually executed.

## 1. Features

* **Screens and modes**: clock, date, message, countdown, OTA, module-grid test,
  pixel-checkerboard test. Priority: OTA > alert/message > countdown > selected
  screen.
* **Full `HH:MM:SS` in the default 48×8 layout**: built-in 5×7 font 42 px,
  Silkscreen Bold (size 7) 46 px, Tiny5 (size 10) 46 px and Press Start 2P
  (size 6) 48 px.
* **Fonts**: three bundled fonts (`fonts/`, OFL licensed) downloaded at build time
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
| C++ code generation | `esphome compile dev.yaml` | headers included, all three fonts instantiated, display writer wired, all actions and OTA callbacks emitted |
| Released example fetched from **real GitHub** (`ref:` = pushed branch) | `INFO Cloning https://github.com/sandro-defender/Esphome-Max7219-Matrix-Clock@...`, **`INFO Configuration is valid!`**, `main.cpp` generated (2955 lines), headers copied into the build `src/` |
| OTA screens in the generated C++ | `UpdateComponentAction<>(matrix)` on `on_begin`/`on_end`/`on_error`, `matrix->update()` inside `on_progress` (only when the percentage changes) |
| Release path (offline) | `scripts/validate-release-offline.sh 0.1.2` | packages cloned from a tagged git repository, **`INFO Configuration is valid!`**, all three web fonts downloaded, `main.cpp` generated (2990 lines), package headers copied into the build `src/` |
| Font width measurements | freetype with ESPHome's `pt_to_px()` | Silkscreen Bold 46 px, Tiny5 46 px, Press Start 2P 48 px, built-in 42 px - all ≤ 48 px |
| Configurator | `cd web-configurator && npm test && npm run typecheck && npm run build` | 42 tests, type-check clean, single-file `dist/index.html` (304.58 kB; 95.65 kB gzip) |
| **Full firmware compile** | `scripts/validate.ps1` with ESPHome 2026.9.0 | **PASS** - firmware linked successfully |

## 6. Build size

The validated ESPHome 2026.9.0 default build uses **507745 of 1044464 bytes of
flash (48.6%)** and **44028 of 81920 bytes of RAM (53.7%)**. That leaves 51.4%
flash and 46.3% RAM headroom with all three repository fonts compiled. The
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

The Silkscreen replacement is published on `main` and released as tag `0.1.2`.
The tests, ESPHome 2026.9.0 configuration validation, full ESP8266 compile and
emulated `0.1.2` release path all passed before publication.
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
