# ESPHome MAX7219 Matrix Clock

A modular ESPHome 2026.9.0 firmware for a MAX7219 LED matrix clock on an
ESP8266, with a full Home Assistant control surface, ten large 8-row fonts, the
optional MD Parola Numeric 7-Segment and MD MAX72XX System faces, a built-in fallback font, per-digit
slide-up animation and on-screen OTA progress.

The firmware is distributed as small package modules. Your YAML stays tiny: it
holds your credentials, a few substitutions and the package list.

## Features

* **Clock and date screens** - full `HH:MM:SS` on the default 48×8 panel,
  12/24-hour modes, three date formats, three seconds modes (digits, bottom-row
  progress bar, off), left/centre/right alignment.
* **Ten large 8-row fonts, MD Parola Numeric 7-Segment, MD MAX72XX System, plus a built-in fallback** - Dot Matrix, Jersey 15,
  Teko, Rajdhani Bold, Kdam Thmor Pro, Rationale, Matrix 2px, Handjet, Oxanium,
  Share Tech Mono, MD Parola Numeric 7-Segment (a MAX7219-matrix bitmap face), and MD MAX72XX System (the MD_MAX72XX `_sysfont` numerals) are
  available. The configurator includes **Matrix 2px and
  Dot Matrix** by default and lets you add **up to three other faces**.
  Dot Matrix is the initial clock face and
  fits `HH:MM` in 31 pixels on a 32x8 panel; Matrix 2px and Share Tech Mono fill
  the 48-pixel clock width, and the
  compact 5×7 bitmap font always fits and needs no download. Matrix 2px is
  generated pixel-for-pixel for the panel: digits use all eight rows and every
  number stroke is exactly two pixels thick. More licensed source faces,
  including two Georgian families, remain in `fonts/` for future testing.
  Fonts are selected from Home Assistant and compiled into the firmware;
  nothing is downloaded at runtime. The web configurator paints every face with
  the very glyphs the firmware compiles.
* **Per-digit slide-up animation** - only digits whose value changed animate,
  non-blocking and safe across `millis()` rollover.
* **Messages and alerts** - scrolling or static text from Home Assistant with a
  bounded length and duration, plus short static status notes.
* **Countdown** - clamped 1 s to 59:59, with a completion message.
* **Day/night brightness** - manual night mode or a configurable start/end hour
  schedule.
* **Automatic clock/date cycling** - optional, with a configurable interval.
* **OTA feedback on the panel** - `OTA`, percentage and a progress bar during
  the upload, `100%` on success, `ERROR` plus the error code on failure,
  restored afterwards.
* **Test patterns** - module-grid and pixel-checkerboard patterns for wiring and
  orientation checks.
* **Diagnostics** - display mode, OTA state, countdown remaining, Wi-Fi signal,
  IP address, SSID, uptime, heap statistics, reset reason and connection status.
* **Secure by default** - native API encryption, encrypted native OTA that
  reuses the API key, no plaintext web-server upload endpoint.

## Web configurator and one-file installer

**[Open the live MAX7219 Clock Web Configurator](https://sandro-defender.github.io/Esphome-Max7219-Matrix-Clock/)**

The [`web-configurator/`](web-configurator/) project is now part of this
repository. It previews the display and generates one ready-to-download device
YAML with:

* local `!secret` references (credentials never enter the browser);
* hardware and display substitutions;
* the complete, version-pinned remote package list;
* first-boot Home Assistant preferences.

The preview is drawn with the same glyph bitmaps, centring, text formats and
font-fallback rules as `packages/max7219_clock_renderer.h`, so what you tune is
what the panel shows — including the per-digit slide-up: only the digits whose
value changed move, the old one leaves upwards while the new one arrives from
below, colons and unchanged digits stay still, and the *Animation duration*
slider (600 ms default), the *Digit slide-up animation* switch and
`prefers-reduced-motion` all drive it. Adjacent 8×8 modules are previewed as one
board — a single panel shell and one continuous dot lattice, exactly like a
soldered chain — and an optional overlay draws dashed guides on each seam
without moving a single pixel. Settings are stored in the browser and can be
shared as a link; nothing but display preferences is ever persisted. Tune groups
controls into keyboard-accessible collapsible sections, with Clock face,
Hardware and Device expanded initially. Collapsing sections keeps all settings.
Around the configurator, the page is now a complete project guide: Live preview,
Tune, Font Lab (firmware faces vs preview-only candidates), Hardware and Wiring,
Install YAML, Home Assistant entities and actions, Troubleshooting, a six-photo
hardware gallery and documentation links. The matrix leads the first screen at
every width: on a phone it stays pinned under the menu at a measured offset,
from 980 px it is a sticky rail beside the settings.

This provides both requested forms without maintaining two divergent firmware
implementations: developers work with the modules in `packages/`, while users
install a single generated YAML and ESPHome downloads those modules and the
font assets automatically.

Run it locally with:

```text
cd web-configurator
npm install
npm run dev
```

The root GitHub Pages workflow tests, type-checks and builds the configurator
before deployment.

## Hardware

| Part | Default |
|---|---|
| Controller | Wemos D1 Mini (ESP8266) |
| Display | six MAX7219 8×8 modules in one row |
| Resolution | 48×8 pixels |
| Clock pin | D8 |
| Data/MOSI pin | D6 |
| Chip-select pin | D7 |
| Panel supply | 5 V, common ground with the ESP8266 |

Change the board, pins, module count, rows, wiring style, rotation and flip
through substitutions in your own YAML - no need to edit the packages:

```yaml
substitutions:
  board: nodemcuv2            # any ESP8266 board id
  matrix_chips: "12"          # 12 modules = 96 pixels wide
  matrix_rows: "1"
  matrix_wiring: snake        # or zigzag
  matrix_rotate_chip: "0"     # 0, 90, 180, 270
  matrix_flip_x: "false"
  matrix_clk_pin: D8
  matrix_mosi_pin: D6
  matrix_cs_pin: D7
  timezone: Europe/Berlin
```

## Installation

1. Install ESPHome 2026.9.0 (`pip install -r requirements-validation.txt`).
2. Copy `secrets.yaml.example` to `secrets.yaml` and fill in your values.
   Keep the existing API key if the device is already paired with Home
   Assistant.
3. Copy `examples/release.yaml` next to your `secrets.yaml` and adjust the
   substitutions for your hardware. Its `ref:`/`project_ref:` (`0.5.1`) must be
   a tag that exists in this repository - see `VALIDATION.md` for how the
   release path is verified.
4. `esphome config max7219-clock.yaml` - must report `Configuration is valid!`
5. `esphome run max7219-clock.yaml` - first flash over USB, later updates over
   the air.

The example downloads the pinned package files and the font files directly from
this repository; nothing else has to be copied locally.

### Secrets

```yaml
wifi_ssid: "YourWiFiSSID"
wifi_password: "YourWiFiPassword"
api_encryption_key: "YOUR_BASE64_32_BYTE_KEY"        # esphome generate-encryption-key
fallback_ap_password: "FallbackHotspotPassword"
web_server_username: "admin"                        # optional web server
web_server_password: "ChangeThisWebPassword"
```

`secrets.yaml` is git-ignored and must never be committed or copied into a
package. Remote packages cannot resolve `!secret`, so your YAML resolves the
values and passes them down as substitutions.

### Local development

```bash
git clone https://github.com/sandro-defender/Esphome-Max7219-Matrix-Clock
cd Esphome-Max7219-Matrix-Clock
cp secrets.yaml.example secrets.yaml     # then edit
esphome config dev.yaml
esphome compile dev.yaml
```

`dev.yaml` loads the same modules with `!include`, so no GitHub round trip is
needed while working on the firmware.

## Home Assistant

All entities appear automatically through the ESPHome integration.

### Selects (configuration)

| Entity | Options |
|---|---|
| Screen | Clock, Date, Message, Module grid test, Pixel checkerboard |
| Clock alignment | Left, Center, Right |
| Time format | 24 hour, 12 hour |
| Seconds display | Off, Digits, Bar |
| Date format | DD.MM, MM/DD, DD/MM |
| Clock font | only included external faces plus Compact 5x7; see [`fonts/README.md`](fonts/README.md) |
| Message scroll | Scroll, Static |

### Numbers

| Entity | Range | Meaning |
|---|---|---|
| Matrix brightness | 0-15 | day brightness |
| Night brightness | 0-15 | used by night mode / schedule |
| Animation duration | 0-2000 ms | 0 disables the slide |
| Message scroll speed | 20-200 ms/px | scrolling speed |
| Default message duration | 0-3600 s | used when an action passes 0 |
| Countdown duration | 10-3599 s | used by the "Start countdown" button |
| Screen cycle interval | 5-300 s | automatic clock/date cycling |
| Night start hour | 0-23 | schedule start |
| Night end hour | 0-23 | schedule end |

### Switches

| Entity | Effect |
|---|---|
| Matrix display | panel power |
| Blinking colon | colon off on odd seconds |
| Digit animation | enables the slide-up animation |
| Automatic screen cycling | clocks/date alternate |
| Night mode | force night brightness now |
| Night schedule | use the start/end hours |
| Display inversion | inverted panel (MAX7219 runtime API) |

### Buttons

`Restart device`, `Return to clock`, `Clear message`, `Start countdown`,
`Cancel countdown`, `Run module grid test`, `Run pixel test`,
`Restore display defaults`.

### Diagnostics (entity category: diagnostic)

`Display mode`, `OTA state`, `Countdown remaining`, `OTA percent` (disabled by
default), `Wi-Fi signal`, `Uptime`, `Free heap`, `Largest free block`,
`Heap fragmentation`, `ESPHome version`, `IP address`, `Connected SSID`,
`Reset reason`, `Device info`, `Status`.

## API actions

Developer tools → Actions (or automations) call:

```yaml
action: esphome.max7219_clock_show_message
data:
  message: "Dinner is ready"     # converted to upper case, max 47 characters
  duration: 30                   # seconds, 0 = use "Default message duration"

action: esphome.max7219_clock_clear_message
action: esphome.max7219_clock_start_countdown
data:
  seconds: 600                   # clamped to 1..3599
action: esphome.max7219_clock_cancel_countdown
action: esphome.max7219_clock_show_status
data:
  note: "WASHING DONE"           # static, max 23 characters
  duration: 20
action: esphome.max7219_clock_get_status      # response with mode/OTA/countdown/heap/uptime
```

The v2.0 action names `show_message` and `clear_message` are unchanged; only
their ESPHome service calls become `actions` in your automations.

## Display behaviour

The renderer decides what to show, in this priority order:

1. **OTA** (highest) - `OTA`, percentage and progress bar while uploading,
   `100%` on success, `ERROR <code>` on failure.
2. **Alerts and messages** - short static notes, then scrolling/static messages.
3. **Countdown** - `MM:SS` until it finishes, then a five second `DONE` note.
4. **Selected screen** - clock, date or a test pattern.

Clock layout degrades gracefully instead of clipping: full `HH:MM:SS` → `HH:MM`
plus the seconds bar → built-in 5×7 font (always fits). If Home Assistant time
is unavailable the SNTP fallback is used, and if no time is known at all the
panel shows `--:--`.

## OTA

Native OTA is encrypted and reuses the API encryption key, so an already-paired
device keeps working: copy the existing key into `secrets.yaml` instead of
generating a new one. A password is deliberately **not** configured (ESPHome
rejects password + encryption together). Version 2.0 had no OTA password, so no
two-step migration is required; the same migration ESPHome documents for
password-protected devices still applies if you are coming from an older
configuration.

Web-server OTA stays disabled (`ota: false` in `packages/web_server.yaml`), so
there is no plaintext firmware upload endpoint next to the encrypted native OTA.

## Validation

```bash
python tests/test_config.py      # offline contract tests + font measurements
make -C tests test               # pure C++ renderer tests
esphome config dev.yaml          # ESPHome 2026.9.0 validation
esphome compile dev.yaml         # full ESP8266 firmware compile
```

* `./scripts/validate.ps1` (Windows) runs the same steps in a temporary
  directory with fake secrets - your real `secrets.yaml` is never read.
* `scripts/validate-release-offline.sh` validates the released example without
  network access by emulating GitHub with a tagged local clone and the font host
  with a local HTTP server.

See [VALIDATION.md](VALIDATION.md) for the commands, the evidence collected
while building these packages and the checks that need hardware.

## Security

* Credentials only behind `!secret`, never inside a package; `secrets.yaml` is
  git-ignored and `tests/test_config.py` fails on literal secrets.
* Native API encryption and encrypted native OTA.
* The web server (optional module) requires authentication and disables its
  firmware upload endpoint.
* Keep the device on a trusted, segmented network; never expose it directly to
  the internet.
* Diagnostics publish on change or once a minute at most, to keep API traffic
  (and ESP8266 CPU) low.

## Troubleshooting

* **Blank display** - check 5 V supply, ground, CS/CLK/DIN wiring, the display
  power switch and brightness. Try "Run pixel test".
* **Modules mirrored or swapped** - change `matrix_wiring`,
  `matrix_rotate_chip` or `matrix_flip_x`, then run the module-grid test.
* **Wrong time** - the clock follows Home Assistant and falls back to SNTP;
  check the `timezone` substitution.
* **Font unreadable** - some faces need the whole 48 px for `HH:MM:SS`;
  the renderer drops the seconds to the bar or falls back to the built-in font
  when a font does not fit. Choose Rationale, Teko or "Compact 5x7" for
  a safer layout.
* **OTA progress not visible** - the panel is updated directly from the OTA
  callbacks; if the custom display lambda is bypassed by a hardware quirk the
  upload still completes. Report it with your board details.
* **`couldn't find remote ref 0.5.1`** - the `ref:` in your YAML pins a release
  tag that does not exist yet (in this repository, or in your fork). Publish it
  first: `git tag 0.5.1 && git push origin 0.5.1` (or create a GitHub release
  for that tag). If ESPHome already cached the failed attempt, run once with
  `refresh: 0s` on the package so it picks the tag up immediately.
* **`Couldn't find ID 'display_mode'`** (or `countdown_remaining`,
  `ota_state`, `ota_percent`, `free_heap`, `uptime_sensor`) - the `files:` list
  in your YAML is missing required modules. Keep the complete list from
  `examples/release.yaml`; `packages/diagnostics.yaml` is referenced by the
  display lambda and the `get_status` action, and `packages/ota_ui.yaml` is
  what provides over-the-air updates. Only `packages/web_server.yaml` may be
  removed.
* **Out of flash** - remove optional extra fonts in Font Lab and rebuild, or drop `packages/web_server.yaml` from the package list (and
  delete it from `files:` in the release example) and rebuild.

## Project layout

```
packages/       firmware modules (base, network, display, fonts, renderer, ...)
fonts/          bundled fonts + licenses and their measurements
examples/       release (pinned tag) and development (@main) user YAMLs
web-configurator/ live preview and one-file installer generator
               (src/glyphs.generated.ts is produced by its scripts/)
tests/          offline contract tests and the C++ renderer tests
scripts/        validate.ps1
dev.yaml        local development entry point
VALIDATION.md   how to validate, evidence, open hardware checks
ROADMAP.md      implementation contract and remaining work
```

## Remaining hardware-only verification

Validated with **ESPHome 2026.9.0** on Python 3.12.7 (`esphome config`, full
ESP8266 `esphome compile` for the default two-face configuration and subset
builds, and `scripts/validate-release-offline.sh 0.4.0`). The renderer is
covered by host tests; the following still needs a real device (see
`VALIDATION.md` and `ROADMAP.md` for details):

* on-panel readability of the included 8-row fonts;
* OTA progress visibility during a real transfer;
* wiring/orientation checks with the built-in test patterns.

## References

* [ESPHome 2026.9.0 release notes](https://esphome.io/changelog/2026.9.0/)
* [MAX7219 Digit Display](https://esphome.io/components/display/max7219digit/)
* [Native API](https://esphome.io/components/api/)
* [OTA automations](https://esphome.io/components/ota/#ota-automations)
* [ESPHome OTA encryption](https://esphome.io/components/ota/esphome/)
* [Web Server](https://esphome.io/components/web_server/)
* [Packages](https://esphome.io/components/packages/)
* [Substitutions](https://esphome.io/components/substitutions/)
* [Font Renderer](https://esphome.io/components/font/)

### Included fonts and upgrades

Font Lab → **Fonts included in firmware** controls compile-time inclusion.
The two default faces cannot be unchecked; select zero to three extras. Only
included faces (and Compact 5×7) appear in the preview/first-boot face picker.
Removing the active extra returns it to Dot Matrix. Reset restores the two
fonts and clears extras. Preferences and share links preserve the selected set;
old links retain their active face as an extra where necessary.

ESPHome restores the Clock font **index**, not its name. Changing extra packages
can map a saved index to a different included face; an out-of-range index uses
the initial choice. Re-select the desired face after flashing a changed subset.
The renderer always has a Compact fallback, and “Restore display defaults” uses
Compact so it also works in a developer's built-in-only configuration.
See [font package design and validation](packages/fonts/README.md).
