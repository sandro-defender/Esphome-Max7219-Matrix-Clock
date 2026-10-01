# Optional release fonts

## Current candidate policy (0.7.0, unreleased)

Default firmware and configurator builds compile exactly **Pixel Clock 6×8 +
Matrix 2px**; **Compact 5×7** is always built in. MD Parola Numeric 7-Segment,
MD MAX72XX System and Dot Matrix are optional. There is no artificial selection
cap on compatible extra faces. The five-face catalogue is not the default build.

| File | Purpose |
| --- | --- |
| `fonts_web.yaml` | Default two-font remote wrapper |
| `fonts_default_local.yaml` | Generated default two-font local wrapper used by `dev.yaml` |
| `fonts_local.yaml` | Generated five-font catalogue for metrics/all-font validation |
| `fonts/*.yaml` | Individually selectable remote face packages |
| `local_fonts/*.yaml` | Generated equivalents with local source paths |

Do not include a wrapper and its individual faces together. Core module lists,
local wrappers, browser font metadata and default installer examples are emitted
by `scripts/generate_firmware_contract.py`. Only `base.yaml` owns the package/
font ref and base asset URL; each face owns its glyphs, compiler flag and select
option. Public installers use a verified immutable tag, not `main`.

## Exact ESPHome 2026.9.1 behavior and checks

- [Packages / Extend](https://esphome.io/components/packages/#extend)
- [Tagged merge_config](https://github.com/esphome/esphome/blob/2026.9.1/esphome/config_helpers.py)
- [Tagged resolve_extend_remove](https://github.com/esphome/esphome/blob/2026.9.1/esphome/config.py)
- [Tagged template select restoration](https://github.com/esphome/esphome/blob/2026.9.1/esphome/components/template/select/template_select.cpp)
- [Tagged font API](https://github.com/esphome/esphome/blob/2026.9.1/esphome/components/font/font.h)

`!extend` string-list options append; scalar lambdas replace. Each face adds a
`-DMAX7219_FONT_*` flag. Corresponding display blocks are feature-guarded and use
raw pointers, so ESPHome does not resolve omitted font IDs. `SourceFont` is
protected by `USE_FONT`; built-in-only firmware needs no external font namespace.
The public packed 1bpp glyphs are drawn through the clipped Canvas rather than
bypassing it with `Font.print`.

Current checks exercise the tagged resolver over all **32 subsets** of five
faces and the exact Pixel/Matrix default order. Five isolated YAML/codegen
variants pass. Independent browser rasterization is compared with official
packed-glyph/MAX7219 writer/SPI fixtures. The Matrix zero's upper-left 2×2 stroke
is repaired without changing its intended two-pixel style or advance.

**No current full ESP8266 link or size result exists:** toolchain acquisition is
blocked by TLS errors. Do not infer candidate size from the older results below.

## Selection and preference restoration

Pixel Clock 6×8 is the default initial clock face. Manual package builds can
still select zero/one/all external faces. Restore display defaults chooses Pixel
when compiled, otherwise Compact, using generated firmware entity defaults.

ESPHome persists a **numeric select index**, not the option label. Compact and
the default pair precede extras; changing the compiled catalogue may remap an
older saved index to another included face. Invalid indices use `initial_option`.
Reselect the desired face after a font-subset change or migration. Unmatched
strings fall back to Compact; omitted faces are never referenced by the renderer.

## Imported faces and licences

`MDMax72xxSystem.ttf` converts the MD_MAX72XX/MD_Parola `_sysfont` numerals;
`MDParolaNumeric7Seg.ttf` converts MD Parola's matrix `numeric7Seg` example.
“Seven-segment” is a digit design on an LED matrix, not a separate display type.
The double-height variant is not used. Both are opt-in and retain their
LGPL-2.1-or-later source/conversion notices (`fonts/md-max72xx-system/LICENSE.txt`).
Pixel Clock, Matrix 2px and Dot Matrix retain their project generation scripts.
Each external face restricts compilation to the clock/status glyph set at
`bpp: 1`; full licence/source information remains with its assets.

## Historical release 0.4.0 measurements — not current build evidence

The following original measurements belong to release 0.4.0 and its original
ESPHome **2026.9.0** toolchain, old Matrix/Dot default pair and larger catalogue.
They do not verify the current default pair, repaired font or 2026.9.1 build.

Measured on ESPHome **2026.9.0** (`d1_mini`, 1,044,464 B flash / 81,920 B RAM)
at release 0.4.0, whose ten-face catalogue also included Jersey 15, Teko,
Rajdhani Bold, Kdam Thmor Pro, Rationale, Handjet, Oxanium and Share Tech Mono
(since removed from the repository; the current catalogue is five faces):

- **Built-in only (0 external faces):** 501,589 B flash (48.0%), 40,088 B RAM (48.9%)
- **Single face (`Matrix 2px`):** 504,085 B flash (48.3%, +2,496 B), 40,676 B RAM (49.7%, +588 B)
- **Single face (`Dot Matrix`):** 504,101 B flash (48.3%, +2,512 B), 40,676 B RAM (49.7%, +588 B)
- **Default two-face pair (`Matrix 2px` + `Dot Matrix`):** **505,141 B flash (48.4%, +3,552 B vs 0 faces)**, **41,276 B RAM (50.4%, +1,188 B vs 0 faces)**
- **Max configurator subset (default 2 + 3 extras):** 507,181 B flash (48.6%, +2,040 B vs default 2), 43,012 B RAM (52.5%, +1,736 B vs default 2)
- **Full 10-face catalogue (`dev.yaml`, 0.4.0):** 510,589 B flash (48.9%, +5,448 B vs default 2), 45,964 B RAM (56.1%, +4,688 B vs default 2)
