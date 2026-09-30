# Changelog

## 0.4.0 - 2026-09-30

- Add compile-time font inclusion for 0.4.0: Matrix 2px and Dot Matrix are
  defaults (with Dot Matrix as the initial active clock face); users can add up
  to three external faces in Tune. Compact 5×7 stays always available. Persist
  and validate inclusion arrays in saved settings and share links.
- Split release fonts into per-face packages (`packages/fonts/*.yaml`) with
  matching `!extend clock_font` option extensions, `-DMAX7219_FONT_*` compiler
  flags, and guarded display wiring. Keep full local measurement catalogue and
  licenses (`packages/fonts_local.yaml`). Reset uses the always-present Compact
  face. Document saved numeric-index restoration semantics (`restore_value: true`)
  across subset changes.
- Validate exact ESPHome 2026.9.0 (Python 3.12.7) config and full ESP8266
  firmware builds for the default two-face configuration (`505,141 / 1,044,464 B`
  flash `48.4%`, `41,276 / 81,920 B` RAM `50.4%`, saving `5,448 B` flash and
  `4,688 B` RAM vs all 10 faces), built-in-only (`0` faces), single-face
  (`Matrix 2px`, `Dot Matrix`), max configurator subset (`5` faces), and offline
  release path (`scripts/validate-release-offline.sh 0.4.0`).
- Publish immutable release tag `0.4.0`, verify remote configuration fetch from
  GitHub (`ref: "0.4.0"`), remove draft `0.4.0` warnings, and enable installer
  copy/download (`INSTALLER_READY = true`) in the web configurator.


- Group Tune controls in native collapsible sections; keep Clock face, Hardware
  and Device expanded initially, preserve settings when collapsed, and add
  disclosure markup regression coverage. Correct stale configurator font counts.

- Join the 8×8 modules in the configurator preview: the 8 px gap between the
  boards is gone, so a six-module panel is painted edge to edge like a soldered
  chain. A new *Module boundary guides* switch draws dashed seam markers as an
  overlay - single-module panels stay untouched and no pixel ever moves.
- Add boundary regression coverage to the configurator: the module seam,
  the guide placement inside the shared bezel, the device-pixel-ratio scaling
  of the dashes and the preview-only keys are asserted directly.

- Add the generated **Matrix 2px** clock face: digits fill all eight matrix
  rows and every number stroke is exactly two pixels thick. The TrueType file
  is produced by `scripts/generate_matrix_font.py` and is asserted
  pixel-for-pixel against its design in `tests/test_config.py`.
- Fix the blinking colon re-centring the clock every second on Rajdhani Bold
  and Rationale, where `:` and space have different advances: the separator
  now keeps its advance and only its ink disappears.
- Fix Latin messages and the `OTA`/`ERROR` screens when an external face is
  selected: texts the selected font cannot render now fall back to the
  built-in font (as the documentation promises) instead of collapsing
  zero-advance glyphs, and message centring uses the metrics of the font that
  actually draws.
- Fix "Restore display defaults" setting the clock font to the non-existent
  option `Silkscreen Bold`; it now restores `Jersey 15`.
- Add the missing `+` glyph to the built-in font and stop float comparison
  noise from republishing the brightness entities every second.
- Fix the configurator type-check (a removed font id was still referenced by
  the fallback tests).

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
