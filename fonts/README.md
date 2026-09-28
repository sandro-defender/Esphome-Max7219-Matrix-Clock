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

## ESPHome usage

Use a version-pinned raw GitHub URL so the font and package configuration always
come from the same release. For example:

```yaml
font:
  - file:
      type: web
      url: >-
        https://raw.githubusercontent.com/sandro-defender/Esphome-Max7219-Matrix-Clock/v1.0.0/fonts/tiny5/Tiny5-Regular.ttf
    id: clock_font_tiny5
    size: 8
    bpp: 1
    glyphs: " 0123456789:%-ABCDEFGHIJKLMNOPQRSTUVWXYZ"
```

Replace `v1.0.0` with the package release being used. Development builds may
temporarily use `main`, but stable examples must use a tag.

Font files are downloaded by ESPHome at compile time. The microcontroller does
not download them at runtime. A Home Assistant font selector therefore chooses
among font IDs already compiled into the firmware.

Before adding another font:

1. Confirm its redistribution license.
2. Store the exact license text beside the font.
3. Add only required glyphs with `bpp: 1` by default.
4. Verify an 8-pixel-high render on a 48×8 matrix.
5. Measure the resulting ESP8266 firmware flash and RAM usage.
6. Test full-size seconds and slide-up digit animation.
