# Optional release fonts (staged 0.4.0)

Each YAML owns one web font declaration, one compiler feature flag, and one
`!extend clock_font` option. Installers list these files explicitly, after the
core packages. `fonts_web.yaml` is only a convenience wrapper for the default
Matrix 2px + Dot Matrix pair; it no longer compiles all ten faces.
`fonts_local.yaml` retains the full local catalogue for development, metrics and
glyph generation. Do not include both the wrapper and its individual faces.

## Why this merge design

Official references (checked against the **2026.9.0** tag):

- [Packages / Extend](https://esphome.io/components/packages/#extend)
- [Core build_flags](https://esphome.io/components/esphome/#configuration-variables)
- [merge_config](https://github.com/esphome/esphome/blob/2026.9.0/esphome/config_helpers.py)
- [resolve_extend_remove](https://github.com/esphome/esphome/blob/2026.9.0/esphome/config.py)
- [template select restoration](https://github.com/esphome/esphome/blob/2026.9.0/esphome/components/template/select/template_select.cpp)

`!extend` **does append options**: string lists concatenate. Scalar lambdas
**replace**, so packages must not try to append lambda text. Each face adds
`-DMAX7219_FONT_*` via `esphome.build_flags`; the display's corresponding guarded
block wraps the generated font pointer and selects it by name. Raw pointers,
not `id()` expressions, are intentional: the preprocessor removes absent faces
without ESPHome trying to resolve their IDs first. `SourceFont` is guarded by
`USE_FONT`, so a built-in-only build needs no font namespace. The built-in
fallback and reset option are always available.

The official tag's merge/extend resolver (`merge_config` and
`resolve_extend_remove`) is exercised over all 1024 subsets and the exact
default release order by `test_exact_esphome_font_option_merge` when ESPHome
2026.9.0 is installed. In addition, full ESPHome 2026.9.0 `esphome config` and
`esphome compile` (ESP8266 `d1_mini`) have been executed for the default
two-face configuration (`Matrix 2px` + `Dot Matrix` + built-in `Compact 5x7`),
built-in-only (`0` external faces), single-face (`Matrix 2px` and `Dot Matrix`),
five-face (default two + three extras), and full ten-face configurations, as
well as the offline release path (`scripts/validate-release-offline.sh 0.4.0`),
confirming codegen, include order, pointer visibility and compiler flag
propagation.

## Selection and restoration

The web UI always includes Matrix 2px + Dot Matrix and permits up to three
extras in catalogue order. Firmware modules support zero/one/all faces for
manual development tests, independently of that UI limit. The base select is
Compact 5x7; the Dot Matrix package changes its initial option to Dot Matrix.
A generated install can override the initial option to any included face.

ESPHome saves a **numeric index**. The web order keeps Compact, Matrix 2px and
Dot Matrix stable, but changing extras may remap a saved extra index to another
included face. Out-of-range indices use initial_option. Older all-font builds
have a different order too: reselect your desired font after flashing.
No restored option can reference an omitted font; the renderer still defaults
to Compact for any unmatched string. Restore display defaults selects Compact.

## Release gate and measurement

0.4.0 is a reserved draft, not a published release. `examples/release.yaml`,
project version, web-configurator metadata and font asset refs are synchronized
to that draft. There is **one** default release configuration (`Matrix 2px` +
`Dot Matrix` + built-in `Compact 5x7`); users may optionally add up to three
extra font packages in the web configurator.

Measured on ESPHome **2026.9.0** (`d1_mini`, 1,044,464 B flash / 81,920 B RAM):

- **Built-in only (0 external faces):** 501,589 B flash (48.0%), 40,088 B RAM (48.9%)
- **Single face (`Matrix 2px`):** 504,085 B flash (48.3%, +2,496 B), 40,676 B RAM (49.7%, +588 B)
- **Single face (`Dot Matrix`):** 504,101 B flash (48.3%, +2,512 B), 40,676 B RAM (49.7%, +588 B)
- **Default two-face pair (`Matrix 2px` + `Dot Matrix`):** **505,141 B flash (48.4%, +3,552 B vs 0 faces)**, **41,276 B RAM (50.4%, +1,188 B vs 0 faces)**
- **Max configurator subset (default 2 + 3 extras):** 507,181 B flash (48.6%, +2,040 B vs default 2), 43,012 B RAM (52.5%, +1,736 B vs default 2)
- **Full 10-face catalogue (`dev.yaml`):** 510,589 B flash (48.9%, +5,448 B vs default 2), 45,964 B RAM (56.1%, +4,688 B vs default 2)

`INSTALLER_READY` remains `false` until the user explicitly approves publishing
tag/release `0.4.0` and a clean temporary configuration verifies fetching the
live `0.4.0` tag and raw font URLs from GitHub. Do not point these paths at
`0.3.0`. No new font files were added; source notices remain in `fonts/*/OFL.txt`.
Matrix 2px and Dot Matrix are project-generated faces.
