# Optional release fonts

## Policy

Default firmware and configurator builds compile exactly **Pixel Clock 6×8 +
Matrix 2px**; **Compact 5×7** is always built in. MD Parola Numeric 7-Segment,
MD MAX72XX System and Dot Matrix are optional. There is no cap on compatible
extra faces, and the six-face catalogue is not the default build.

| File | Purpose |
| --- | --- |
| `fonts_web.yaml` | default two-face remote wrapper (Pixel Clock 6×8 + Matrix 2px) |
| `fonts_default_local.yaml` | generated local wrapper for the same default pair, used by `dev.yaml` |
| `fonts_local.yaml` | generated six-face catalogue for metrics and all-font validation |
| `fonts/*.yaml` | individually selectable remote face packages |
| `local_fonts/*.yaml` | generated local equivalents with local source paths |

Do not include a wrapper and its individual faces together. Core module lists,
local wrappers, browser font metadata and the installer examples are emitted by
`scripts/generate_firmware_contract.py`. Only `base.yaml` owns the package/font
ref and base asset URL; each face owns its glyphs, compiler flag and select
option. Public installers use a verified immutable tag, never `main`.

## Exact ESPHome 2026.9.1 behaviour and checks

- [Packages / Extend](https://esphome.io/components/packages/#extend)
- [Tagged merge_config](https://github.com/esphome/esphome/blob/2026.9.1/esphome/config_helpers.py)
- [Tagged resolve_extend_remove](https://github.com/esphome/esphome/blob/2026.9.1/esphome/config.py)
- [Tagged template select restoration](https://github.com/esphome/esphome/blob/2026.9.1/esphome/components/template/select/template_select.cpp)
- [Tagged font API](https://github.com/esphome/esphome/blob/2026.9.1/esphome/components/font/font.h)

`!extend` string-list options append; scalar lambdas replace. Each face adds one
`-DMAX7219_FONT_*` flag. The matching display blocks are feature-guarded and use
raw pointers, so ESPHome does not resolve omitted font IDs. `SourceFont` is
protected by `USE_FONT`; built-in-only firmware needs no external font namespace.
Packed 1 bpp glyphs are drawn through the clipped Canvas, not `Font.print`.

Current checks exercise the tagged resolver over all **64 subsets** of six faces
and the exact default order, and the browser rasterisation is compared with
packed-glyph/MAX7219 writer/SPI fixtures from the same tagged SDK. The Matrix 2px
zero's upper-left 2×2 stroke is repaired without changing its two-pixel style or
advance.

**No current firmware link or size result exists.** CI never compiles firmware;
toolchain acquisition has failed with TLS errors in sandboxes
([docs/HISTORY.md](../../docs/HISTORY.md)). Do not present the historical
numbers below as current.

## Selection and preference restoration

Pixel Clock 6×8 is the default initial clock face. Manual package builds can
select zero, one or all external faces. "Restore display defaults" chooses Pixel
Clock 6×8 when compiled, otherwise Compact, using generated entity defaults.

ESPHome persists a **numeric select index**, not the option label. Compact and
the default pair precede extras; changing the compiled catalogue may remap an
older saved index to another included face. Invalid indices use
`initial_option`. Reselect the desired face after a font-subset change. Unmatched
strings fall back to Compact; omitted faces are never referenced by the renderer.

## Imported faces and licences

`MDMax72xxSystem.ttf` converts the MD_MAX72XX/MD_Parola `_sysfont` numerals;
`MDParolaNumeric7Seg.ttf` converts MD Parola's matrix `numeric7Seg` example.
"Seven-segment" is a digit design on an LED matrix, not a separate display type.
The double-height variant is not used. Both are opt-in and retain their
LGPL-2.1-or-later source/conversion notices
(`fonts/md-max72xx-system/LICENSE.txt`). Pixel Clock 6×8, Matrix 2px and Dot
Matrix retain their project generation scripts. Each external face restricts
compilation to the clock/status glyph set at `bpp: 1`; full licence and source
information stays with the assets in [fonts/README.md](../../fonts/README.md).

## Historical release 0.4.0 measurements — not current build evidence

Measured on ESPHome **2026.9.0** (`d1_mini`, 1,044,464 B flash / 81,920 B RAM) at
release `0.4.0`, whose ten-face catalogue also included Jersey 15, Teko,
Rajdhani Bold, Kdam Thmor Pro, Rationale, Handjet, Oxanium and Share Tech Mono
(since removed; the current catalogue has six faces). The font policy and
default pair have changed since.

- **Built-in only (0 external faces):** 501,589 B flash (48.0%), 40,088 B RAM (48.9%)
- **Single face (`Matrix 2px`):** 504,085 B flash (48.3%, +2,496 B), 40,676 B RAM (49.7%, +588 B)
- **Single face (`Dot Matrix`):** 504,101 B flash (48.3%, +2,512 B), 40,676 B RAM (49.7%, +588 B)
- **Default two-face pair of that release (`Matrix 2px` + `Dot Matrix`):** 505,141 B flash (48.4%), 41,276 B RAM (50.4%)
- **Max configurator subset of that release (5 faces):** 507,181 B flash (48.6%), 43,012 B RAM (52.5%)
- **Full ten-face catalogue:** 510,589 B flash (48.9%), 45,964 B RAM (56.1%)

Measuring the current source is an open item in [ROADMAP.md](../../ROADMAP.md).
