# Bundled fonts

These font source files are stored in this repository so ESPHome builds can
download reproducible assets directly from the same release as the package
configuration.

| Family | Source file | License |
|---|---|---|
| Tiny5 | [`tiny5/Tiny5-Regular.ttf`](tiny5/Tiny5-Regular.ttf) | [`tiny5/OFL.txt`](tiny5/OFL.txt) |
| Press Start 2P | [`press-start-2p/PressStart2P-Regular.ttf`](press-start-2p/PressStart2P-Regular.ttf) | [`press-start-2p/OFL.txt`](press-start-2p/OFL.txt) |

The files are redistributed under the SIL Open Font License 1.1 included beside
each font. Their upstream source is the
[Google Fonts repository](https://github.com/google/fonts).

## How the firmware uses them

`packages/fonts_web.yaml` (release) downloads them with `type: web` and
`bpp: 1`, pinned to the same tag as the package files:

```yaml
font:
  - id: font_tiny5_source
    file:
      type: web
      url: ${fonts_base_url}/tiny5/Tiny5-Regular.ttf   # github raw URL + ${project_ref}
    size: 10
    bpp: 1
    glyphs:
      - "0123456789:.-/%!?+ "
      - "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
```

`packages/fonts_local.yaml` reads the same files from `fonts/` for offline
development. `tests/test_config.py` asserts both modules stay identical (ids,
sizes, `bpp`, glyphs) and re-measures the fonts.

## Measurements (ESPHome `pt_to_px()` metrics)

Measured with freetype-py using ESPHome's own advance calculation
(`pt_to_px(horiAdvance)`, i.e. rounding up to whole pixels):

| Font | `size` | Ink per digit | `HH:MM:SS` width | Fits 48×8 |
|---|---|---|---|---|
| Tiny5 | 10 | 4×6 px | 46 px | yes, 1 px margin on each side |
| Press Start 2P | 6 | 5×6 px | 48 px | yes, exact fit |
| built-in 5×7 fallback | - | 5×7 px (3 px separators) | 42 px | yes, always available |

The renderer checks the width at runtime and degrades in a fixed order:
full `HH:MM:SS` → `HH:MM` plus the bottom-row seconds bar → built-in fallback
font. So an unsuitable font, a narrower panel or a different module count never
clips the clock: it falls back instead. The slide-up animation works per glyph
and is therefore font independent.

Glyph sets are limited on purpose (digits, separators, `%`, `.`, `-`, `/`, `!`,
`?`, space and A-Z); messages are converted to upper case by the firmware.
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
4. Add the option to the "Clock font" select in `packages/controls.yaml`.
5. Run `python tests/test_config.py` - it fails if the font does not fit
   `HH:MM:SS` on the default 48×8 layout.
6. Measure the ESP8266 flash usage after a full compile and document it here.
