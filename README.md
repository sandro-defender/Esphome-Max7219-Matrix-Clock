# ESPHome MAX7219 Matrix Clock

An ESPHome configuration for an ESP8266/Wemos D1 Mini driving a daisy-chain of
MAX7219 8×8 LED matrix modules. The project integrates with Home Assistant and
is being upgraded toward a feature-rich ESPHome 2026.9.0 clock.

## Current capabilities

- Clock and date screens
- 12-hour and 24-hour time formats
- Configurable matrix brightness and display power
- Optional blinking separator
- Seconds display and progress-bar modes
- Scrolling messages sent from Home Assistant
- Module-grid and pixel-checkerboard test screens
- Configurable chip count, rows, wiring style, rotation, and horizontal flip
- Native API encryption, OTA support, fallback access point, and web controls

See [ROADMAP.md](ROADMAP.md) for the ordered implementation plan covering
full-size seconds, slide-up digit animation, expanded Home Assistant controls,
countdowns, diagnostics, encrypted OTA, and firmware-upload progress on the
matrix.

## Planned package layout

The finished project will not require users to copy one large YAML file. A
small device configuration will define local secrets and substitutions, then
download modular package files directly from this repository with ESPHome's
remote `packages` support. Package modules will separate the device base,
network and OTA, display hardware, fonts, rendering/state, Home Assistant
controls, actions, diagnostics, and OTA display.

Release examples will pin both package files and font URLs to the same version
tag. An `@main` example may be provided for development, but should not be the
recommended stable installation path. Remote packages cannot look up a user's
local secrets, so the small local configuration will pass secret-backed values
through substitutions.

The exact ready-to-copy example will be added when the modular package has
passed configuration validation and a full firmware compile. Until then, use
the checked-in configuration described below rather than an unfinished remote
package example.

## Bundled fonts

The repository includes two pixel-style font families in [`fonts/`](fonts/):

| Font | File | License | Intended use |
|---|---|---|---|
| Tiny5 | `fonts/tiny5/Tiny5-Regular.ttf` | SIL Open Font License 1.1 | Compact clock and status text |
| Press Start 2P | `fonts/press-start-2p/PressStart2P-Regular.ttf` | SIL Open Font License 1.1 | Alternate clock/message style |

Each font directory contains its license. ESPHome can fetch these files as web
fonts from this repository during compilation. The planned Home Assistant font
selector will switch between fonts already compiled into the firmware; the
device will not download fonts at runtime. Glyph subsets and one-bit rendering
will be used to protect ESP8266 flash and RAM headroom.

## Default hardware

| Part | Default |
|---|---|
| Controller | Wemos D1 Mini / ESP8266 |
| Display | Six MAX7219 8×8 modules in one row |
| Resolution | 48×8 pixels |
| Clock pin | D8 |
| Data/MOSI pin | D6 |
| Chip-select pin | D7 |

The pin names and matrix layout are substitutions near the top of
`esphome_Max7219-Matrix-Clock/max7219-clock.yaml`. Confirm them against your
actual wiring before flashing.

## Configuration

Copy the example secrets file to `secrets.yaml` in the configuration directory
and replace every placeholder:

```yaml
wifi_ssid: "YOUR_WIFI_NETWORK"
wifi_password: "YOUR_WIFI_PASSWORD"
api_encryption_key: "YOUR_BASE64_32_BYTE_KEY"
fallback_ap_password: "YOUR_STRONG_FALLBACK_PASSWORD"
```

Never commit `secrets.yaml`. If the device is already paired with Home
Assistant, preserve its existing API encryption key instead of generating a new
one.

## Installation

1. Install ESPHome 2026.9.0.
2. Create the local `secrets.yaml` file.
3. Confirm the board, pins, chip count, rows, wiring style, rotation, and flip
   substitutions.
4. Validate the YAML.
5. Compile the complete firmware.
6. Perform the first installation over USB when necessary.
7. Add the device to Home Assistant through the ESPHome integration.

For an already-installed device that uses an OTA password, follow ESPHome's
official two-step migration before requiring OTA encryption. Removing an old
OTA password too early can prevent the transitional upload.

## Home Assistant

The configuration exposes display settings and API actions through the ESPHome
integration. Available entities depend on the currently completed roadmap
phase. Planned controls include display mode, brightness, time format, seconds,
animation, countdown, day/night behavior, diagnostics, and test patterns.

Parameterized operations such as scrolling a message or starting a countdown
belong in native API actions. Ordinary persistent settings should use native
Home Assistant entities instead.

## Agent development

AI agents must begin with [AGENTS.md](AGENTS.md) and follow the checkbox order
in [ROADMAP.md](ROADMAP.md). Important rules include:

- Target ESPHome 2026.9.0 exactly.
- Use official ESPHome documentation for framework behavior.
- Keep the firmware modular and configurable through substitutions.
- Make the stable install download version-pinned packages and fonts directly
  from this repository.
- Preserve existing user changes.
- Never request or commit credentials.
- Add regression coverage before behavioral changes.
- Do not push firmware changes until tests, YAML validation, and a complete
  firmware compile succeed.

## Validation expectations

The completed project should provide a reproducible PowerShell validator that:

- Installs the pinned ESPHome version in an isolated environment
- Runs repository regression tests
- Validates a temporary copy of the YAML with test-only secrets
- Optionally compiles the complete ESP8266 firmware
- Never reads or changes production secrets

Consult `VALIDATION.md` when that validation tooling is present in the checked
out revision.

## Security

- Keep the device on a trusted, segmented local network.
- Never expose the ESPHome web server directly to the internet.
- Use native API encryption.
- Prefer encrypted native OTA in ESPHome 2026.9.0.
- Disable regular web-server OTA when it would expose a plaintext upload path.
- Add web-server authentication if web controls are retained on an untrusted
  network.

## Troubleshooting

- **Blank display:** verify power, ground, chip select, clock, data, display
  power, and brightness.
- **Modules appear reversed:** adjust the wiring style, rotation, or horizontal
  flip substitutions and run the module-grid test.
- **Wrong time:** confirm Home Assistant is connected and providing time.
- **Clock does not fit:** the full `HH:MM:SS` design targets at least 48×8
  pixels; narrower displays require a fallback layout.
- **OTA fails after changing authentication:** restore the previous OTA
  password/key configuration and follow the official migration sequence.
- **Unexpected reboots:** inspect ESP8266 RAM/flash usage and reduce low-value
  entities or web features if headroom is too small.

## References

- [ESPHome 2026.9.0 release notes](https://esphome.io/changelog/2026.9.0/)
- [MAX7219 Digit Display](https://esphome.io/components/display/max7219digit/)
- [Native API](https://esphome.io/components/api/)
- [OTA automations](https://esphome.io/components/ota/#ota-automations)
- [ESPHome OTA encryption](https://esphome.io/components/ota/esphome/)
- [ESPHome packages](https://esphome.io/components/packages/)
- [ESPHome substitutions](https://esphome.io/components/substitutions/)
- [ESPHome font renderer](https://esphome.io/components/font/)
