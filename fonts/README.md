# Bundled Fonts

Every font in this directory has an explicit open license, is checked into the
repository for offline ESPHome compilation, and is extracted automatically by
`scripts/generate_firmware_contract.py` and `web-configurator/scripts/generate_glyphs.py`.

## Default unified face

| Directory / file | Family | License | Character sets included |
| ---------------- | ------ | ------- | ----------------------- |
| `max7219.ttf` | max7219 Georgian (`max7219`) | MIT (`fonts/LICENSE.txt`) | Standard ASCII digits (`0–9`, 5×7, 1 px stroke), Custom big digits (`U+E000–U+E009`, 6×8, 2 px stroke), English uppercase (`A–Z`), English lowercase (`a–z`), Georgian Mkhedruli (`ა–ჰ`, `U+10D0–U+10F0`), and clock/status punctuation (`:.-/%!?+ `) |

Any additional `.ttf` or `.otf` font dropped into `fonts/` and paired with a
package in `packages/fonts/<slug>.yaml` and metadata in `packages/configurator.json`
is automatically discovered and exposed in both Home Assistant (`Clock font`,
`Date font`, `Temperature font`, `Message font`) and the Web Configurator.

The firmware also keeps a built-in 5×7 pixel fallback in
`packages/max7219_clock_renderer.h` (`Compact 5x7`) plus the generated Georgian
and custom-big digit tables in `packages/max7219_date_font.generated.h` so the
display remains readable even when external fonts are omitted.

## Make your own face

The [Pixeel font editor](https://sandro-defender.github.io/Pixeel-font-editor/)
draws 8-row pixel faces in the browser and exports a drop-in package for this
clock. The font lab in the Web Configurator links to it, and
[docs/PIXEEL_FONTS.md](../docs/PIXEEL_FONTS.md) explains the export contract,
the personal custom slot and catalogue contributions.
