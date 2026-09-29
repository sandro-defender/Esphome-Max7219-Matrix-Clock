# Changelog

## 0.3.0 - 2026-09-29

- Make five large, exact-eight-row faces the default firmware font set: Jersey
  15, Teko, Rajdhani Bold, Kdam Thmor Pro and Rationale.
- Keep the broader licensed font catalogue in the repository without compiling
  all faces into every ESP8266 build.
- Correct the configurator's inverted LED preview and prevent glow halos from
  merging adjacent pixels.
- Add automated coverage for per-LED inversion, glow bounds, exact font height,
  clock width and firmware/configurator font parity.

## 0.2.0 - 2026-09-29

- Add 28 OFL clock-font choices, bringing the repository catalogue to 33 faces.
- Add Noto Sans Georgian and Noto Serif Georgian at 8 px with complete modern
  Mkhedruli and Mtavruli glyph sets.
- Add real-glyph previews for every face to the web configurator.
- Keep the complete catalogue within ESP8266 limits by compiling numeric/status
  glyphs in external faces and using the compact built-in font for Latin text.
- Validate the full build with ESPHome 2026.9.0: 50.7% flash and 77.1% RAM.

## 0.1.2 - 2026-09-28

- Add the Silkscreen Bold default face and publish the initial configurator.
