# MAX7219 Matrix Clock Web Configurator

A client-side React/Vite project site for the ESPHome MAX7219 Matrix Clock in
this repository. It previews the display pixel by pixel and generates one small
installation YAML backed by the version-pinned modules in `../packages/`.

The page is a single scrolling document with an anchor nav: **Live preview ·
Tune · Font Lab · Hardware and Wiring · Install YAML · Home Assistant ·
Troubleshooting · Gallery · Docs**. The design contract — visual language,
responsive strategy, accessibility checklist and the test matrix — lives in
[REDESIGN.md](REDESIGN.md).

The live matrix is the first thing on screen at every width. The preview column
holds only the device — panel, current time, selected face and fit — so the
whole block stays above the fold and can remain pinned while the settings scroll
past; the preview controls (frozen preview time, message composer, digit-slide
readout, fact strip) head the settings column beside it. On phones the chassis
is pinned under the header at the *measured* offset, so the section nav can
never cover the matrix and the matrix can never cover the header buttons; from
980 px the preview becomes a sticky rail beside the sections.

## The preview draws the firmware, not an approximation

`src/render.ts` follows `../packages/max7219_clock_renderer.h` step by step:

| Preview | Firmware |
|---|---|
| `clockContent()` | `build_content()` for `MODE_CLOCK` |
| `dateContent()` | `build_content()` for `MODE_DATE` |
| `font.boxTop(band)` | `GlyphFont::centered_box_top()` |
| drop seconds → built-in fallback | the fallback chain in `render()` |
| marquee offset | `draw_free_text()` |
| bottom-row progress line | `draw_seconds_bar()` |

The glyph bitmaps are not hand-written. `scripts/generate_glyphs.py` reads
`../packages/fonts_local.yaml` (ids, files, sizes, glyph sets) and rasterises
those exact files with FreeType, so a font change in the firmware package shows
up in the browser after one command:

```text
pip install pyyaml pillow
python3 scripts/generate_glyphs.py           # rewrite src/glyphs.generated.ts
python3 scripts/generate_glyphs.py --check   # fail if it is stale (used in CI)
```

The one-digit-per-8×8-module drawing is explicitly labelled *illustration* in
the UI: the firmware draws the clock proportionally.

`src/MatrixCanvas.tsx` joins the modules edge to edge (`gap === 0`,
`inset === 0`) and paints **one** board: a single panel shell, a single dark
face and one continuous dot lattice, so nothing is drawn between two 8×8 boards
and the dot pitch is identical at every seam. The sizer also caps the pitch by
the available width, so the panel is never wider than its container — no
horizontal page overflow at 320 px. The optional **Module boundary guides**
switch draws dashed lines into the shared bezel between two boards. The guides
are an overlay: they are drawn after the LEDs and never change the dot pitch,
the module origins or the canvas size, which the boundary tests assert
directly.

## The preview slides digits like the firmware

`src/digitAnimation.ts` mirrors `draw_line()` in
`../packages/max7219_clock_renderer.h`: when the clock content changes, only the
characters that are digits in both the old and the new content and whose value
changed move. The outgoing digit is drawn `offset` rows higher and the incoming
digit `slide - offset` rows lower, with `slide = font.ink_height()` and
`offset = floor(progress * slide)`; `progress` runs 0 → 1 over the **Animation
duration** slider (600 ms default, 0 disables the slide) and the **Digit
slide-up animation** switch turns the whole effect off. Colons keep their
advance and never move, unchanged digits never move, and a screen or length
change cancels the slide — the firmware's `same_layout` rule. `Replay last
change` in the preview controls runs one slide from the previous second so the
effect can be seen on a frozen preview time.

The animation is time-driven, never blocking: a `requestAnimationFrame` loop
repaints only when the whole-row offset changes (an eight-row panel cannot show
sub-row positions) and stops as soon as the slide settles. `prefers-reduced-motion:
reduce` disables it completely and says so in the panel.

## What “one YAML” means

The downloaded device file is the only YAML an end user needs to maintain. It
contains local `!secret` references, substitutions, first-boot preferences and
the complete remote `packages` declaration. During validation and compilation,
ESPHome downloads the modular firmware and only the chosen external fonts from the
matching repository release.

The configurator does not copy the complete renderer into every generated file.
That keeps the one-file installation path synchronized with the tested modular
firmware instead of creating a second implementation that can drift.

Font inclusion selects package files; other firmware controls map to a substitution or to a restored Home
Assistant entity in `../packages/controls.yaml`; the tests compare the generated
YAML against `../examples/release.yaml` and the font picker against
`../packages/controls.yaml`, so the two cannot drift silently. The preview-only
aids (LED colour, preview layout, module boundary guides, frozen preview time)
have no firmware counterpart: the UI labels them *preview only* and a test
asserts they never reach the generated YAML.

## Settings storage

Display preferences are kept in `localStorage` and can be shared as a URL
fragment (`#cfg=…`, base64url encoded JSON). Every value is validated and
clamped on the way in, so a hand-edited link cannot break the preview. The
**Reset** button clears the saved settings.

## Security

The browser never asks for Wi-Fi, API, OTA or web-server credentials. Generated
files refer to entries in the user's local `secrets.yaml`. No credential is
stored in JavaScript, browser storage, generated YAML or this repository.

## Development

```text
npm install
npm test          # vitest suite in src/*.test.ts / src/*.test.tsx
npm run typecheck
npm run dev
```

Create a production build with:

```text
npm run build
```

The Vite single-file plugin emits `dist/index.html`. Build output and
`node_modules` are ignored by Git.

## Tests

| File | Covers |
|---|---|
| `src/yaml.test.ts` | generated installer YAML, release-example sync, clamping, font options, storage/share links |
| `src/render.test.ts` | clock/date text, font fallback, seconds modes, test patterns, night dimming, auto cycling |
| `src/MatrixCanvas.test.ts` | seamless module joining, seam geometry, panel-fits-its-box sizing, optional boundary guides, LED optics |
| `src/digitAnimation.test.ts` | the per-digit slide: timing, duration, switch, reduced motion, layout changes, and the drawn frame (changed digit moves, everything else is pixel-identical) |
| `src/app.test.tsx` | the whole app renders (static markup smoke test): sections, nav, gallery alt/captions, doc links, disclosure groups, and the parsed layout contract (preview order, sticky rail, pinned-mobile offsets and stacking) |
| `src/app.dom.test.tsx` | the mounted app in jsdom: measured pin offsets, matrix-first markup, slide replay/settle through the UI, reduced motion, font checkbox → preview → installer YAML, gallery, no credential inputs |
| `src/fontSelection.test.tsx` | font inclusion contracts plus the Font Lab width-warning wording |

`src/yaml.test.ts` also reads the firmware sources next door, so adding a font
to `../packages/fonts_local.yaml` without adding it to `src/fontCatalog.ts` (or
vice versa) fails the test suite.

## GitHub Pages

The repository-level workflow
[`../.github/workflows/deploy-configurator.yml`](../.github/workflows/deploy-configurator.yml)
checks that the generated glyphs are current, installs dependencies, runs the
tests, type-checks the app, builds it and deploys `web-configurator/dist` to
GitHub Pages.

## Generated firmware contract

The generator pins package YAML and web-font assets to the same release tag. It
includes the same module list as `../examples/release.yaml`:

* base device and network/API configuration;
* renderer and MAX7219 display bridge;
* Matrix 2px and Dot Matrix included by default, up to three chosen extras,
  plus the always-available built-in Compact 5×7 fallback;
* Home Assistant controls and API actions;
* diagnostics and on-matrix OTA progress;
* authenticated web server with browser-based OTA disabled.

Update the generator tests whenever the release package list or substitution
contract changes.

Tune uses native collapsible sections. Clock face, Hardware and Device start
expanded so essential settings remain visible; open Screen, Messages and Light
as needed. Section headers support keyboard focus and Enter/Space. Collapsing a
section does not reset settings or change generated YAML or shared links.
Troubleshooting uses the same native disclosures.

## Choosing compiled fonts

The **Font Lab** section separates the two tiers visibly:

* **Fonts included in firmware** — labelled checkboxes over every optional
  face, a live `0 / 3` … `3 / 3` counter, and cards rasterised from the exact
  compiled files. Checking an optional face adds the package *and immediately
  selects it in the live preview*; at the limit, unchecked extras are disabled;
  uncheck one before adding another. Matrix 2px and Dot Matrix are fixed
  defaults; removing the active extra returns to Dot Matrix without resetting
  other settings. A plain-language warning fires whenever the selected face is
  wider than the panel (seconds dropped → HH:MM + bar → built-in 5×7).
* **Preview-only Font Lab** — candidate faces (Georgian families, Audiowide,
  Bitcount …) for side-by-side comparison. They are labelled *preview only*,
  never compiled into the ESP8266 firmware and never written into the
  generated installer YAML; the YAML tests assert both.

The inclusion array is normalized into catalogue order, deduplicated, restricted
to known external faces and clamped to three extras. Defaults are restored even
from hostile links. Old links without a font array retain their active face as
one extra. Reset returns to the two defaults; localStorage and share links retain
extras otherwise. `src/fontSelection.test.tsx` covers these contracts.

`packages/fonts_local.yaml` remains the complete measurement/preview catalogue,
not the default release font set. Per-face release declarations are tested for
id/size/glyph/source parity with it. No glyph regeneration noise is expected.
