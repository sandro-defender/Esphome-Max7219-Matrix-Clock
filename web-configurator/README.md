# MAX7219 Matrix Clock Web Configurator

A client-side React/Vite configurator for the ESPHome MAX7219 Matrix Clock in
this repository. It previews the display pixel by pixel and downloads one small
installation YAML backed by the version-pinned modules in `../packages/`.

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

## What “one YAML” means

The downloaded device file is the only YAML an end user needs to maintain. It
contains local `!secret` references, substitutions, first-boot preferences and
the complete remote `packages` declaration. During validation and compilation,
ESPHome downloads the modular firmware and the three bundled fonts from the
matching repository release.

The configurator does not copy the complete renderer into every generated file.
That keeps the one-file installation path synchronized with the tested modular
firmware instead of creating a second implementation that can drift.

Every control in the Tune tab maps to a substitution or to a restored Home
Assistant entity in `../packages/controls.yaml`; the tests compare the generated
YAML against `../examples/release.yaml` and the font picker against
`../packages/controls.yaml`, so the two cannot drift silently.

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
npm test
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
| `src/app.test.tsx` | the whole app renders (static markup smoke test) |

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
* repository-hosted Silkscreen Bold, Tiny5 and Press Start 2P fonts;
* Home Assistant controls and API actions;
* diagnostics and on-matrix OTA progress;
* authenticated web server with browser-based OTA disabled.

Update the generator tests whenever the release package list or substitution
contract changes.
