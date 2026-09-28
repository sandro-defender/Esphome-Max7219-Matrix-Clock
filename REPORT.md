# Final report - modular MAX7219 clock (ESPHome 2026.9.0)

Release: **0.1.0** (pinned consistently in `examples/release.yaml`,
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
  Tiny5 (size 10) 46 px, Press Start 2P (size 6) 48 px.
* **Fonts**: two bundled fonts (`fonts/`, OFL licensed) downloaded at build time
  from a tag-pinned raw GitHub URL, restricted glyph sets, `bpp: 1`, plus a
  built-in fallback font that needs nothing and always fits. Runtime font
  selection switches between compiled font IDs only.
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
| Contract tests | `python tests/test_config.py` | 25 tests, **OK** (needs PyYAML; ESPHome installs it) |
| Renderer unit tests | `make -C tests test` | **163 checks, 0 failures** |
| ESPHome config validation | `esphome config dev.yaml` (2026.9.0) | **`INFO Configuration is valid!`** |
| C++ code generation | `esphome compile dev.yaml` (codegen phase) | `main.cpp` generated (2948 lines): headers included, both fonts instantiated, display writer wired, all actions and OTA callbacks emitted |
| Released example fetched from **real GitHub** (`ref:` = pushed branch) | `INFO Cloning https://github.com/sandro-defender/Esphome-Max7219-Matrix-Clock@...`, **`INFO Configuration is valid!`**, `main.cpp` generated (2955 lines), headers copied into the build `src/` |
| OTA screens in the generated C++ | `UpdateComponentAction<>(matrix)` on `on_begin`/`on_end`/`on_error`, `matrix->update()` inside `on_progress` (only when the percentage changes) |
| Release path (offline) | `scripts/validate-release-offline.sh 0.1.0` | packages cloned from a tagged git repository, **`INFO Configuration is valid!`**, both web fonts downloaded, `main.cpp` generated (2955 lines), package headers copied into the build `src/` |
| Font width measurements | freetype with ESPHome's `pt_to_px()` | Tiny5 46 px, Press Start 2P 48 px, built-in 42 px - all ≤ 48 px |
| **Full firmware compile** | `esphome compile dev.yaml` | **not executed** - PlatformIO registry unreachable in the build environment |

## 6. Build size

Not available. A firmware size and RAM headroom review requires a complete
PlatformIO build, which needs `dl.registry.platformio.org`; that host is not
reachable from the environment used to prepare this release. The measurement
step is left unchecked in `ROADMAP.md` (Phase 4 and Phase 12) and listed in
`VALIDATION.md` as a hardware/network-dependent check. Nothing here claims a
safe headroom figure.

## 7. Files changed

Added: `packages/` (11 modules + 2 C++ headers + README),
`examples/release.yaml`, `examples/development.yaml`, `dev.yaml`,
`secrets.yaml.example` (moved to the root and extended),
`tests/test_config.py`, `tests/test_renderer.cpp`, `tests/Makefile`,
`scripts/validate.ps1`, `scripts/validate-release-offline.sh`,
`requirements-validation.txt`, `VALIDATION.md`, `REPORT.md`.

Updated: `README.md` (complete rewrite for the package layout),
`fonts/README.md` (measurements, glyph sets, add-a-font steps), `ROADMAP.md`
(checkboxes with evidence, 8 left unchecked on purpose), `.gitignore`
(`__pycache__/`, `.venv/`, `validation-tmp/`).

Removed: `esphome_Max7219-Matrix-Clock/max7219-clock.yaml` and its
`secrets.yaml.example` (superseded; the history keeps the v2.0 firmware).

## 8. Commit and push status

All work is committed on the session branch
`arena/01a0e58b-esphome-max7219-matrix-clock`.

The full ESP8266 firmware compile could not run in the preparation environment
(no PlatformIO registry access), and the roadmap makes a passing compile part of
the push gate, so the work was pushed as a **feature branch only** and reviewed
through pull request
[#1](https://github.com/sandro-defender/Esphome-Max7219-Matrix-Clock/pull/1)
(base `main`, 32 files, +5066/-782). `main` itself was never pushed to and no
tag was created.

Before merging, run `scripts/validate.ps1` (or `esphome compile dev.yaml`) on a
machine with PlatformIO access - that is the missing gate and it also produces
the build-size numbers for Phase 4/12. After merging, tag the reviewed commit
`0.1.0`: `examples/release.yaml`, `packages/base.yaml` and
`packages/fonts_web.yaml` already pin that version (enforced by the contract
tests), so the release example becomes resolvable as soon as the tag exists.

No force-push was used at any point.

## 9. Remaining hardware-only verification

1. Full `esphome compile` with a reachable PlatformIO toolchain, then review
   flash/RAM usage and ESP8266 headroom (Phase 4/12 boxes stay unchecked).
   `scripts/validate-release-offline.sh` covers everything up to that point and
   can be re-run with a working toolchain to produce the missing numbers.
2. On-panel readability of Tiny5 (size 10) and Press Start 2P (size 6).
3. OTA upload with a real device: confirm the progress screen redraws from the
   OTA callbacks (`id(matrix).update()`).
4. Wiring/orientation confirmation with the module-grid and pixel tests.
5. Behaviour of the physical controls (display power, inversion, night
   brightness, 12/24-hour and date formats).

## 10. Deviations and open items

* Eight roadmap checkboxes remain unchecked, each annotated in `ROADMAP.md`:
  firmware size recording/review, OTA-callback verification "by compilation",
  the full ESP8266 compile, the real OTA upload test, the push gate and the
  `HEAD == origin/main` confirmation.
* The release example uses the explicit remote-package form (`url` + `ref` +
  `files`) instead of the `github://` shorthand, because only the explicit form
  can pin a tag and load several files (including the two C++ headers) as one
  package. `github://` remains documented in `packages/README.md`.
* A separate message-font selector was deliberately not added: without a
  firmware size review there is no evidence of safe headroom.
