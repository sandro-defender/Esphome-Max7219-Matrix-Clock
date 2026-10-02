# ESPHome MAX7219 Matrix Clock

A modular ESPHome **2026.9.1** firmware for a MAX7219 LED matrix clock on an
ESP8266 (Wemos D1 mini), with a full Home Assistant control surface, five
optional 8-row clock faces plus a built-in fallback, per-digit slide-up
animation, and OTA progress shown on the panel.

Small package modules keep your YAML short: credentials, substitutions, packages.

## Install with the web configurator

**[Open the live MAX7219 Clock Web Configurator](https://sandro-defender.github.io/Esphome-Max7219-Matrix-Clock/)**

The configurator previews the display with the exact glyphs the firmware
compiles, and generates one ready-to-download device YAML. It verifies the
newest published release (tag, release notes, tagged firmware contract and
commit) before enabling the download, and fails closed when verification is
unavailable — a paused or unverified release never enables the installer.
Nothing but anonymous GitHub release lookups leaves the page: no credential, no
telemetry, no IP lookup — see [web-configurator/README.md](web-configurator/README.md).

On a first visit the **Timezone** field is pre-filled with your browser's IANA
zone (read locally, never sent); **Use my timezone** re-applies it. A saved
configuration, a shared link or a failed detection keeps its own timezone
(firmware default `Europe/Berlin`).

### Manual installation

1. Install ESPHome 2026.9.1: `pip install -r requirements-validation.txt`.
2. Copy `secrets.yaml.example` to `secrets.yaml` and fill in your values
   (keep the existing API key if the device is already paired).
3. Copy `examples/release.yaml` next to it and adjust the substitutions for your
   hardware. Its `ref:` and `project_ref:` are generated from `project_ref` in
   `packages/base.yaml`, pin one published version tag and must stay identical.
4. `esphome config <your-file>.yaml` — must report `Configuration is valid!`.
5. `esphome run <your-file>.yaml` — first flash over USB, later updates over
   the air.

ESPHome downloads the pinned package files and font assets from this repository;
nothing else has to be copied locally. `dev.yaml` is the local development entry
point: it loads the same modules with `!include`, so no GitHub round trip is
needed while working on the firmware.

## Hardware

| Part | Default |
|---|---|
| Controller | Wemos D1 mini (ESP8266) |
| Display | six MAX7219 8×8 modules in one row |
| Resolution | 48×8 pixels |
| Clock pin | D8 |
| Data/MOSI pin | D6 |
| Chip-select pin | D7 |
| Panel supply | 5 V, common ground with the ESP8266 |

Change the board, pins, module count, rows, wiring style, rotation and flip
through substitutions in your own YAML — no need to edit the packages:

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
  timezone: Europe/Berlin     # used by Home Assistant time and the SNTP fallback
```

## Features

* **Clock and date screens** — `HH:MM:SS` on 48×8, 12/24-hour modes, three date
  formats, three seconds modes (digits, bottom-row bar, off), left/centre/right
  alignment.
* **Five optional 8-row faces plus a built-in fallback** — see
  [Fonts](#fonts). Fonts are compiled into the firmware; nothing is downloaded
  at runtime and the Home Assistant selector only switches compiled IDs.
* **Per-digit slide-up animation** — only digits whose value changed animate,
  non-blocking and safe across `millis()` rollover.
* **Messages and alerts** — scrolling or static text from Home Assistant with
  bounded length and duration; **countdown** from 1 s to 59:59 with a completion
  note; **day/night brightness** with a start/end hour schedule; optional
  **clock/date cycling** with a configurable interval.
* **OTA feedback on the panel** — `OTA`, percentage and progress bar during the
  upload, `100%` on success, `ERROR` plus the error code on failure.
* **Test patterns and diagnostics** — module-grid and pixel-checkerboard patterns
  for wiring checks, plus display mode, OTA state, countdown remaining, Wi-Fi
  signal, IP address, SSID, uptime, heap statistics, reset reason and status.
* **Secure by default** — native API encryption, encrypted native OTA reusing
  the API key, no plaintext web-server upload endpoint.

## Home Assistant

All entities appear automatically through the ESPHome integration.

### Selects

| Entity | Options |
|---|---|
| Screen | Clock, Date, Message, Module grid test, Pixel checkerboard |
| Clock alignment | Left, Center, Right |
| Time format | 24 hour, 12 hour |
| Seconds display | Off, Digits, Bar |
| Date format | DD.MM, MM/DD, DD/MM |
| Clock font | included external faces plus Compact 5×7 |
| Message scroll | Scroll, Static |

### Numbers

| Entity | Range | Meaning |
|---|---|---|
| Matrix brightness | 0-15 | day brightness |
| Night brightness | 0-15 | used by night mode / schedule |
| Animation duration | 0-2000 ms | 0 disables the slide |
| Animation row gap | 0-2 rows | blank rows between the old and new digit |
| Message scroll speed | 20-200 ms/px | scrolling speed |
| Default message duration | 0-3600 s | used when an action passes 0 |
| Countdown duration | 10-3599 s | used by the "Start countdown" button |
| Screen cycle interval | 5-300 s | automatic clock/date cycling |
| Night start / end hour | 0-23 | schedule bounds |

### Switches, buttons and diagnostics

Switches: Matrix display, Blinking colon, Digit animation, Automatic screen
cycling, Night mode, Night schedule, Display inversion.
Buttons: `Restart device`, `Return to clock`, `Clear message`, `Start countdown`,
`Cancel countdown`, `Run module grid test`, `Run pixel test`,
`Restore display defaults`.
Diagnostics (category: diagnostic): `Display mode`, `OTA state`,
`Countdown remaining`, `OTA percent` (disabled by default), `Wi-Fi signal`,
`Uptime`, `Free heap`, `Largest free block`, `Heap fragmentation`,
`ESPHome version`, `IP address`, `Connected SSID`, `Reset reason`, `Device
info`, `Status`.

### API actions

Developer tools → Actions (or automations) call:

```yaml
action: esphome.max7219_clock_show_message
data: { message: "Dinner is ready", duration: 30 }  # upper case, max 47 chars
action: esphome.max7219_clock_clear_message
action: esphome.max7219_clock_start_countdown
data: { seconds: 600 }              # clamped to 1..3599
action: esphome.max7219_clock_cancel_countdown
action: esphome.max7219_clock_show_status
data: { note: "WASHING DONE", duration: 20 }        # static, max 23 chars
action: esphome.max7219_clock_get_status            # mode/OTA/countdown/heap/uptime
```

## Display behaviour

The renderer decides what to show, in this priority order:

1. **OTA** (highest) — progress while uploading, `100%` on success,
   `ERROR <code>` on failure.
2. **Alerts and messages** — short static notes, then messages.
3. **Countdown** — `MM:SS` until it finishes, then a five-second `DONE` note.
4. **Selected screen** — clock, date or a test pattern.

Clock layout degrades instead of clipping: full `HH:MM:SS` → `HH:MM` plus the
seconds bar → built-in 5×7 font (always fits). If Home Assistant time is
unavailable the SNTP fallback is used; with no time at all the panel shows
`--:--`.

## Fonts

Default builds compile exactly **Pixel Clock 6×8** (initial face) and
**Matrix 2px**; **Compact 5×7** is always built in. Dot Matrix, MD Parola
Numeric 7-Segment and MD MAX72XX System are optional per-face packages with no
selection cap. ESPHome restores the Clock font **index**, not its name, so
re-select the face after flashing a changed font subset; unmatched options fall
back to Compact.

Licences, generated-font sources and the add-a-font checklist are in
[fonts/README.md](fonts/README.md); the package policy is in
[packages/fonts/README.md](packages/fonts/README.md).

## Secrets and security

```yaml
wifi_ssid: "YourWiFiSSID"
wifi_password: "YourWiFiPassword"
api_encryption_key: "YOUR_BASE64_32_BYTE_KEY"        # esphome generate-encryption-key
fallback_ap_password: "FallbackHotspotPassword"
web_server_username: "admin"                         # optional web server
web_server_password: "ChangeThisWebPassword"
```

* Credentials live only behind `!secret` in *your* YAML; `secrets.yaml` is
  git-ignored and `tests/test_config.py` fails on literal secrets. Remote
  packages cannot resolve `!secret`, so your YAML passes values down as
  substitutions.
* Native API encryption and encrypted native OTA; web-server firmware upload
  stays disabled (`ota: false`), so there is no plaintext upload endpoint.
* Keep the device on a trusted, segmented network; never expose it directly to
  the internet.
* Diagnostics publish on change or once a minute at most.

## Troubleshooting

* **Blank display** — check 5 V supply, ground, CS/CLK/DIN wiring, the display power switch and brightness; run "Run pixel test".
* **Modules mirrored or swapped** — change `matrix_wiring`, `matrix_rotate_chip` or `matrix_flip_x`, then run the module-grid test.
* **Wrong time** — the clock follows Home Assistant and falls back to SNTP; check the `timezone` substitution.
* **Font unreadable** — some faces need the whole 48 px for `HH:MM:SS`; the renderer drops seconds or falls back to Compact. Prefer
  Dot Matrix, MD Parola Numeric 7-Segment or Compact 5×7 for a safer layout.
* **`couldn't find remote ref <tag>`** — the `ref:` in your YAML pins a tag that does not exist (in this repository or in your fork).
  Tags come only from the main-push workflow; never create one by hand. See [RELEASING.md](RELEASING.md).
* **`Couldn't find ID 'display_mode'`** (or another diagnostics ID) — the `files:` list is missing modules. Keep the complete list
  from `examples/release.yaml`; only `packages/web_server.yaml` may be removed.
* **Out of flash** — remove optional fonts and rebuild, or drop `packages/web_server.yaml` from the package list and `files:`.
* **Installer disabled in the browser** — the page is waiting for a verified release, or the anonymous GitHub API quota for your
  network is exhausted (the status line shows an automatic retry time). See [RELEASING.md](RELEASING.md#anonymous-api-quota).

## Validation and documentation

```bash
python scripts/check_code.py              # full code gate; see VALIDATION.md
make -C tests test                        # host C++ renderer tests
esphome config dev.yaml                   # ESPHome config validation
```

* [VALIDATION.md](VALIDATION.md) — exact commands, Python/Node versions, what
  `--skip-sdk-checks` omits, and what CI never verifies.
* [RELEASING.md](RELEASING.md) — the release/Pages pipeline, tag scheme and
  recovery rules.
* [ROADMAP.md](ROADMAP.md) — open items with acceptance criteria.
* [docs/HISTORY.md](docs/HISTORY.md) — why past decisions were made.
* [packages/README.md](packages/README.md) — firmware module map.

### Project layout

```
packages/       firmware modules (base, network, display, fonts, renderer, ...)
fonts/          bundled font files + licences
examples/       generated release (pinned tag) and development (@main) YAMLs
web-configurator/ live preview and one-file installer generator
tests/          offline contract tests and the C++ renderer tests
scripts/        contract generator, code gate, release publisher, validators
dev.yaml        local development entry point
```

### Unverified

CI neither compiles nor flashes firmware. ESP8266 flash/RAM figures, on-device readability, animation feel and
encrypted-OTA progress are **Unverified** for the current source; only dated historical measurements exist
([VALIDATION.md](VALIDATION.md), [packages/fonts/README.md](packages/fonts/README.md)).
