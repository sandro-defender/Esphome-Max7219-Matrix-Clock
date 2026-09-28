# Bundled fonts

These font source files are stored in this repository so ESPHome builds can
download reproducible assets directly from the same release as the package
configuration. The web configurator rasterises the very same files, so its
preview shows the real glyphs instead of a web-font approximation.

| Family | Source file | License |
|---|---|---|
| Silkscreen Bold | [`silkscreen/Silkscreen-Bold.ttf`](silkscreen/Silkscreen-Bold.ttf) | [`silkscreen/OFL.txt`](silkscreen/OFL.txt) |
| Tiny5 | [`tiny5/Tiny5-Regular.ttf`](tiny5/Tiny5-Regular.ttf) | [`tiny5/OFL.txt`](tiny5/OFL.txt) |
| Press Start 2P | [`press-start-2p/PressStart2P-Regular.ttf`](press-start-2p/PressStart2P-Regular.ttf) | [`press-start-2p/OFL.txt`](press-start-2p/OFL.txt) |
| Audiowide | `audiowide/` | `audiowide/OFL.txt` |
| Bitcount Grid Double | `bitcount-grid-double/` | `bitcount-grid-double/OFL.txt` |
| Bitcount Grid Single | `bitcount-grid-single/` | `bitcount-grid-single/OFL.txt` |
| Bitcount Prop Double | `bitcount-prop-double/` | `bitcount-prop-double/OFL.txt` |
| Bitcount Prop Single | `bitcount-prop-single/` | `bitcount-prop-single/OFL.txt` |
| Bitcount Single | `bitcount-single/` | `bitcount-single/OFL.txt` |
| Bytesized | `bytesized/` | `bytesized/OFL.txt` |
| DotGothic16 | `dotgothic16/` | `dotgothic16/OFL.txt` |
| Doto | `doto/` | `doto/OFL.txt` |
| Electrolize | `electrolize/` | `electrolize/OFL.txt` |
| Handjet | `handjet/` | `handjet/OFL.txt` |
| Iceland | `iceland/` | `iceland/OFL.txt` |
| Jersey 10 / 15 / 20 / 25 | `jersey-10/`, `jersey-15/`, `jersey-20/`, `jersey-25/` | `OFL.txt` in each folder |
| Major Mono Display | `major-mono-display/` | `major-mono-display/OFL.txt` |
| Micro 5 | `micro-5/` | `micro-5/OFL.txt` |
| Nova Mono | `nova-mono/` | `nova-mono/OFL.txt` |
| Orbitron | `orbitron/` | `orbitron/OFL.txt` |
| Oxanium | `oxanium/` | `oxanium/OFL.txt` |
| Pixelify Sans | `pixelify-sans/` | `pixelify-sans/OFL.txt` |
| Quantico Bold | `quantico/` | `quantico/OFL.txt` |
| Rubik Pixels | `rubik-pixels/` | `rubik-pixels/OFL.txt` |
| Share Tech Mono | `share-tech-mono/` | `share-tech-mono/OFL.txt` |
| Sixtyfour | `sixtyfour/` | `sixtyfour/OFL.txt` |
| VT323 | `vt323/` | `vt323/OFL.txt` |
| Wallpoet | `wallpoet/` | `wallpoet/OFL.txt` |
| Noto Sans Georgian | `noto-sans-georgian/` | `noto-sans-georgian/OFL.txt` |
| Noto Serif Georgian | `noto-serif-georgian/` | `noto-serif-georgian/OFL.txt` |

The files are redistributed under the SIL Open Font License 1.1 included beside
each font. All 33 faces come from the official
[Google Fonts repository](https://github.com/google/fonts). Silkscreen Bold is
the default because its two-pixel strokes stay strong on a small LED matrix.

## How the firmware uses them

`packages/fonts_web.yaml` (release) downloads them with `type: web` and
`bpp: 1`, pinned to the same tag as the package files:

```yaml
font:
  - id: font_silkscreen_bold_source
    file:
      type: web
      url: ${fonts_base_url}/silkscreen/Silkscreen-Bold.ttf   # github raw URL + ${project_ref}
    size: 7
    bpp: 1
    glyphs:
      - "0123456789:.-/%!?+ "
```

`packages/fonts_local.yaml` reads the same files from `fonts/` for offline
development. `tests/test_config.py` asserts that both modules stay identical
(ids, sizes, `bpp`, glyphs), that every compiled font is selectable in Home
Assistant and wired into the display lambda, and that the glyph set covers
every character the renderer can print.

Only rasterised glyphs are compiled into firmware, never the TTF/OTF files.
The 33-face ESP8266 build uses 529709 bytes flash (50.7%) and 63200 bytes RAM
(77.1%). Compiling Latin letters into every face exceeded DRAM, so external
faces intentionally contain only numeric/status glyphs. The built-in compact
font renders Latin messages. The Georgian faces additionally compile all 33
Mkhedruli and all 33 Mtavruli letters.

The Home Assistant message action stores 47 UTF-8 bytes. That is up to 15
Georgian letters (plus a terminator); truncation is code-point safe and never
leaves half of a Georgian character in the display buffer.

## Measurements (ESPHome `pt_to_px()` metrics)

Measured two ways, both in the repository:

* `tests/test_config.py` uses freetype-py with ESPHome's advance calculation
  (`pt_to_px(horiAdvance)`, i.e. rounding up to whole pixels);
* `web-configurator/scripts/generate_glyphs.py` rasterises the same files with
  FreeType through Pillow, which is what the browser preview paints.

| Font | `size` | worst-case `88:88:88` width | Tallest digit | Fits 48×8 | Notes |
|---|---|---|---|---|---|
| Silkscreen Bold | 7 | 44 px | 5 px | yes | default; thick two-pixel strokes and room for the seconds bar |
| Tiny5 | 10 | 36 px | 6 px | yes | narrow tall alternative; leaves row 8 free for the seconds bar |
| Press Start 2P | 6 | 48 px | 7 px | yes, exact fit | fills the width, row 8 stays free |
| Noto Sans Georgian | 8 | 34 px | 7 px | yes | Mkhedruli and Mtavruli messages |
| Noto Serif Georgian | 8 | 28 px | 7 px | yes | Mkhedruli and Mtavruli messages |
| built-in 5×7 fallback | - | 42 px | 7 px | yes, always available | needs no download |

The automated measurement covers every other catalogued face as well. Their
chosen sizes range from 6 to 12 px; every `88:88:88` result is at most 48 px
wide and every numeric glyph uses at most eight rows. The web configurator
shows the generated bitmap for each face so they can be compared visually.

Silkscreen Bold size 8 is deliberately **not** used: `HH:MM:SS` reaches 50 px
and would not fit the default panel. Size 7 keeps the bold pixel structure while
leaving two pixels of total horizontal headroom.

The renderer checks the width at runtime and degrades in a fixed order:
full `HH:MM:SS` → `HH:MM` plus the bottom-row seconds bar → built-in fallback
font. So an unsuitable font, a narrower panel or a different module count never
clips the clock: it falls back instead. The slide-up animation works per glyph
and is therefore font independent.

Glyph sets are limited on purpose (digits, separators, `%`, `.`, `-`, `/`, `!`,
`?`, `+` and space). Latin messages fall back to the built-in uppercase face;
Georgian messages render through either Noto Georgian choice. Compiling fewer
glyphs is what keeps all 33 choices inside ESP8266 DRAM.

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
7. Run `python3 tests/test_config.py` - it fails if the font does not fit the
   worst-case numeric clock on the default 48×8 layout, if a required glyph is missing, or if
   the font is not selectable.
8. Run `cd web-configurator && npm test` - it fails if the configurator and the
   firmware disagree about the available fonts.
9. Measure the ESP8266 flash usage after a full compile and document it here.

Silkscreen Bold source SHA-256:
`768476aa712d4f5c3e18d3bce80f980a8bd3f72b7094d22ec5e768df3acfed61`.
