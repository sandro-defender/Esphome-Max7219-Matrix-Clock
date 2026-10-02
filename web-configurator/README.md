# MAX7219 Matrix Clock web configurator

Static React/Vite site for the ESPHome MAX7219 Matrix Clock. It previews the
display pixel by pixel with the glyphs the firmware actually compiles, and
generates one small installer YAML backed by the version-pinned packages in
[`../packages/`](../packages/). Live at
<https://sandro-defender.github.io/Esphome-Max7219-Matrix-Clock/>.

The page is a single scrolling document (Live preview, Tune, Font Lab, Hardware
and Wiring, Install YAML, Home Assistant, Troubleshooting, Gallery, Docs). The
matrix is the first thing on screen at every width and becomes a sticky rail
from 980 px.

## Development

```bash
cd web-configurator
npm ci
npm run dev          # local dev server
npm test             # vitest suite (src/*.test.ts, src/*.test.tsx)
npm run typecheck    # tsc --noEmit
npm run build        # single-file production bundle in dist/
python3 scripts/generate_glyphs.py          # rewrite src/glyphs.generated.ts
python3 scripts/generate_glyphs.py --check  # fail if it is stale (used in CI)
```

`generate_glyphs.py` needs Python 3.12+ with `esphome==2026.9.1` importable and
`freetype-py` (`pip install -r ../requirements-validation.txt`). Node 20+ works
locally; CI uses Node 22.

## Generated files — never hand-edit

| File | Produced by |
| --- | --- |
| `src/glyphs.generated.ts` | `scripts/generate_glyphs.py` from `../packages/fonts_local.yaml` and the font files |
| `src/firmware.generated.json` | `../scripts/generate_firmware_contract.py` from the firmware packages and `../packages/configurator.json` |
| `package.json` / `package-lock.json` versions | the same contract generator |
| `../packages/restore_defaults.generated.yaml`, `../packages/local_fonts/*.yaml`, `../packages/fonts_default_local.yaml`, `../packages/fonts_local.yaml`, `../examples/*.yaml` | the same contract generator |

`python ../scripts/generate_firmware_contract.py --check` (and the glyph
`--check`) fail on drift; see [VALIDATION.md](../VALIDATION.md).

## How the preview stays honest

`src/render.ts` follows `../packages/max7219_clock_renderer.h` step by step
(clock/date content, centring, fallback chain, marquee, seconds bar), and
`src/digitAnimation.ts` mirrors `draw_line()`: only digits that changed move,
within their own ink height; colons and unchanged digits stay still; a screen or
length change cancels the slide. Runtime state is retained in
`src/previewTimeline.ts` with uint32 millisecond arithmetic, civil clock time and
timezone kept separate. `src/MatrixCanvas.tsx` draws one continuous dot lattice
across module seams; the optional boundary guides are an overlay and never move
a dot or change the canvas size.

## Hardware targets

`Tune → Hardware target` switches between the **ESP8266 Wemos D1 mini**
(`../packages/base.yaml`, `d1_mini`, `D8`/`D6`/`D7`, OTA port 8266) and the
**ESP-WROOM-32 DevKit** (`../packages/base-esp32.yaml`, `esp32dev`, CLK
`GPIO18`, DIN `GPIO23`, CS `GPIO5`, OTA port 3232). The board and pin selects,
the installer's module list and its pins all come from `hardwareTargets` in
`src/firmware.generated.json`; `src/hardware.ts` expands only the selected
board, and a foreign board or pin alias fails installer generation instead of
being written.

## Timezone detection

`src/timezone.ts` reads the browser's IANA zone from
`Intl.DateTimeFormat().resolvedOptions().timeZone` and validates it with the
firmware's own `sanitizeTimezone()` (`src/yaml.ts`), so the detected value flows
unchanged into the installer YAML (`timezone: <zone>`) and the live preview.
Detection runs only on a **first visit** (no saved config, no shared link): a
saved configuration or link always wins, and a failed or invalid detection keeps
the firmware default. The **Use my timezone** button next to the field re-applies
the detected zone at any time and shows it. Everything is client-side — no
geolocation API, no IP lookup, no permission prompt, no network request.

## Release verification

`src/release.ts` finds the newest **published** release by `published_at` (never
GitHub's "Latest" marker or the version number), checks its tagged
`firmware.generated.json` against the page's own contract (repository, ESPHome
version, schema version, `sourceHash`, release version), requires the release
body to equal `## <tag>` plus the CHANGELOG section, resolves the plain `X.Y.Z`
tag to a commit (annotated tags bounded, cycles rejected), and compares that
commit with the `VITE_RELEASE_COMMIT` embedded in the bundle.
Installer export stays disabled until all of that passes, and re-verifies before
each export.

## Rate-limit handling

The page uses anonymous GitHub API calls: **60 requests per hour per IP**,
shared by a NAT/VPN, and `304`s still count. Each verification costs two
requests, so results are reused (5 minutes on focus/reload, 15-minute background
recheck, 30 seconds across consecutive exports). A 403/429 with
`x-ratelimit-remaining: 0` becomes a pause with an automatic retry time
("Automatic retry at HH:MM") derived from `Retry-After`/`x-ratelimit-reset`
(default 5 minutes, capped at 65); a manual Retry button is shown. Never "fix"
quota pressure by embedding a token in the page. Full pipeline detail:
[RELEASING.md](../RELEASING.md#anonymous-api-quota).

## Storage and sharing

Display preferences live in `localStorage`; the Share button encodes them as a
base64url URL fragment (`#cfg=…`). Every value is validated and clamped on the
way in, so a hand-edited link cannot break the preview. A shared link is adopted
once, then stored locally and removed from the URL. Reset clears the saved
settings. The page never asks for credentials: generated YAML references the
user's local `secrets.yaml` with `!secret` only.

## Tests

| File | Covers |
| --- | --- |
| `src/yaml.test.ts` | installer YAML generation, release-example sync, clamping, unknown zones rejected, storage/share links |
| `src/render.test.ts` | clock/date text, font fallback, seconds modes, test patterns, night dimming, auto cycling |
| `src/parity.test.ts` | tagged native/browser pixel oracle over the retained C++ fixture |
| `src/previewTimeline.test.ts` | sequential native/browser frames for cycling, messages, preference edits, rollover |
| `src/digitAnimation.test.ts` | slide timing, duration, switch, reduced motion, layout changes, drawn frame |
| `src/MatrixCanvas.test.ts` | seamless module joining, seam geometry, sizing, boundary guides, LED optics |
| `src/release.test.ts` | release lookup, response bounds, rate-limit pause, fail-closed selection |
| `src/timezone.test.tsx` | first-visit detection, invalid-zone fallback, saved/link precedence, generated YAML, the re-apply button |
| `src/app.test.tsx` | app smoke test: sections, nav, gallery, docs links, disclosures, layout contract |

`src/yaml.test.ts` reads the firmware sources next door, so adding a font to
`../packages/fonts_local.yaml` without `src/fontCatalog.ts` (or vice versa)
fails the suite.

## Deployment

The repository workflow
[`../.github/workflows/validate-code.yml`](../.github/workflows/validate-code.yml)
runs the full code gate on every main push and PR, publishes the matching
installer release on a main push, builds this app with `VITE_RELEASE_COMMIT` and
deploys the artifact to GitHub Pages. Details and recovery rules:
[RELEASING.md](../RELEASING.md).
