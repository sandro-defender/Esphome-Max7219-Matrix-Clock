# Bundled fonts

These font source files are stored in this repository so ESPHome builds can
download reproducible assets directly from the same release as the package
configuration. The web configurator rasterises the very same files, so its
preview shows the real glyphs instead of a web-font approximation.

| Family | Source file | License |
|---|---|---|
| Tiny5 | [`tiny5/Tiny5-Regular.ttf`](tiny5/Tiny5-Regular.ttf) | [`tiny5/OFL.txt`](tiny5/OFL.txt) |
| Press Start 2P | [`press-start-2p/PressStart2P-Regular.ttf`](press-start-2p/PressStart2P-Regular.ttf) | [`press-start-2p/OFL.txt`](press-start-2p/OFL.txt) |
| Matrix Bold | [`Matrix-Bold/Matrix_Bold.ttf`](Matrix-Bold/Matrix_Bold.ttf) | [`Matrix-Bold/OFL.txt`](Matrix-Bold/OFL.txt) |
| Eight Bit Dragon | [`eight_bit_dragon/eight-bit-dragon.otf`](eight_bit_dragon/eight-bit-dragon.otf) | [`eight_bit_dragon/OFL.txt`](eight_bit_dragon/OFL.txt) |

The files are redistributed under the SIL Open Font License 1.1 included beside
each font. Their upstream sources are the
[Google Fonts repository](https://github.com/google/fonts) (Tiny5, Press Start 2P),
[FontStruct](https://fontstruct.com) (Eight Bit Dragon) and the Press Start 2P
project (Matrix Bold).

## How the firmware uses them

`packages/fonts_web.yaml` (release) downloads them with `type: web` and
`bpp: 1`, pinned to the same tag as the package files:

```yaml
font:
  - id: font_matrix_bold_source
    file:
      type: web
      url: ${fonts_base_url}/Matrix-Bold/Matrix_Bold.ttf   # github raw URL + ${project_ref}
    size: 10
    bpp: 1
    glyphs:
      - "0123456789:.-/%!?+ "
      - "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
```

`packages/fonts_local.yaml` reads the same files from `fonts/` for offline
development. `tests/test_config.py` asserts that both modules stay identical
(ids, sizes, `bpp`, glyphs), that every compiled font is selectable in Home
Assistant and wired into the display lambda, and that the glyph set covers
every character the renderer can print.

Only the rasterised glyphs are compiled into the firmware, never the TTF/OTF
file. With ~46 glyphs at `bpp: 1` each face costs a few hundred bytes of
flash, which is why adding a face is cheap; the size measurement that still has
to be repeated after a full compile is noted below.

## Measurements (ESPHome `pt_to_px()` metrics)

Measured two ways, both in the repository:

* `tests/test_config.py` uses freetype-py with ESPHome's advance calculation
  (`pt_to_px(horiAdvance)`, i.e. rounding up to whole pixels);
* `web-configurator/scripts/generate_glyphs.py` rasterises the same files with
  FreeType through Pillow, which is what the browser preview paints.

| Font | `size` | `HH:MM:SS` width | Tallest digit | Fits 48×8 | Notes |
|---|---|---|---|---|---|
| Tiny5 | 10 | 46 px | 6 px | yes, 1 px margin on each side | default; leaves row 8 free for the seconds bar |
| Press Start 2P | 6 | 48 px | 7 px | yes, exact fit | fills the width, row 8 stays free |
| Matrix Bold | 10 | 40 px | 7 px | yes, 4 px margin on each side | heavy strokes, best read through glass |
| Eight Bit Dragon | 7 | 36 px | 6 px | yes, 6 px margin on each side | dense retro digits, row 8 free for the bar |
| built-in 5×7 fallback | - | 42 px | 7 px | yes, always available | needs no download |

Sizes 11 and 12 of Matrix Bold are deliberately **not** used: their `9` reaches
past the eighth row. Eight Bit Dragon is compiled at 7 instead of 8 so the
bottom row stays free for the seconds bar.

The renderer checks the width at runtime and degrades in a fixed order:
full `HH:MM:SS` → `HH:MM` plus the bottom-row seconds bar → built-in fallback
font. So an unsuitable font, a narrower panel or a different module count never
clips the clock: it falls back instead. The slide-up animation works per glyph
and is therefore font independent.

Glyph sets are limited on purpose (digits, separators, `%`, `.`, `-`, `/`, `!`,
`?`, `+`, space and A-Z); messages are converted to upper case by the firmware.
Compiling fewer glyphs keeps ESP8266 flash usage down. ESPHome logs a warning
and draws a placeholder box for a character that is not compiled in, so extend
the `glyphs:` lists (or add lowercase letters) if you need more.

Fonts are downloaded and rasterised at **build time**; the ESP8266 never
downloads anything at runtime. The Home Assistant font selector switches between
font IDs that are already compiled into the firmware.

## Adding another font

1. Confirm its redistribution license and store the license text beside it.
2. Add the file under `fonts/<family>/`.
3. Add it to `packages/fonts_web.yaml` **and** `packages/fonts_local.yaml` with
   the same `id`, `size`, `bpp` and `glyphs`.
4. Add the option to the "Clock font" select in `packages/controls.yaml` and map
   the new `id` in `FONT_OPTION_BY_ID` in `tests/test_config.py`.
5. Instantiate it in the display lambda in `packages/display.yaml`.
6. Add the face to `FONT_CATALOG` in `web-configurator/src/fontCatalog.ts` and
   run `python3 web-configurator/scripts/generate_glyphs.py`.
7. Run `python3 tests/test_config.py` - it fails if the font does not fit
   `HH:MM:SS` on the default 48×8 layout, if a required glyph is missing, or if
   the font is not selectable.
8. Run `cd web-configurator && npm test` - it fails if the configurator and the
   firmware disagree about the available fonts.
9. Measure the ESP8266 flash usage after a full compile and document it here.
