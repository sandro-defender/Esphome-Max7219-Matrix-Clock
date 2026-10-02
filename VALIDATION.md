# Validation

CI runs [`scripts/check_code.py`](scripts/check_code.py) on every main push
and PR. No check in this repository compiles, links or flashes firmware for you:
that needs a build host and, for real confidence, a device.

## Requirements

| Tool | Version | Used for |
| --- | --- | --- |
| Python | **3.12–3.14** | `esphome==2026.9.1` must be importable; the generator imports its schema/font APIs without running the CLI |
| `requirements-validation.txt` | `esphome==2026.9.1`, `freetype-py==2.5.1`, `fonttools==4.66.1` | exact SDK imports, font metrics, glyph freshness |
| Node.js | **22** (CI; 20+ works locally) | configurator tests, typecheck, Vite bundle |
| `web-configurator` npm deps | `package-lock.json` | `npm ci` |
| g++ | C++17 | host renderer tests |

## Commands

Run from the repository root:

```bash
python -m venv .venv && . .venv/bin/activate
pip install -r requirements-validation.txt
npm --prefix web-configurator ci --ignore-scripts
python scripts/check_code.py                       # full code gate
```

| Check | Command | Covers |
| --- | --- | --- |
| Firmware contract freshness | `python scripts/generate_firmware_contract.py --check` | generated JSON/YAML/npm version match the firmware sources and the `all_paths` hash |
| Glyph freshness | `python web-configurator/scripts/generate_glyphs.py --check` | committed preview bitmaps match the fonts the firmware compiles |
| Host renderer | `make -C tests test fixture` | C++ state machine, layout, animation, OTA screens; browser parity fixture |
| Python regressions | `python -m unittest discover -s tests -p "test_*.py" -v` | source contracts, real installer/package merges through SDK helpers (not whole-config validation), publisher, workflow/Pages guards (remote calls mocked) |
| Web tests | `npm --prefix web-configurator test` | preview parity, YAML generator, storage/share links, release resolver |
| TypeScript | `npm --prefix web-configurator run typecheck` | `tsc --noEmit` |
| Web bundle | `npm --prefix web-configurator run build` | production single-file bundle (not firmware) |
| Whitespace | `git diff --check` | trailing whitespace, conflict markers |

Regeneration is an intentional source change, never a substitute for `--check`:

```bash
python scripts/generate_firmware_contract.py
python web-configurator/scripts/generate_glyphs.py     # only after font changes
```

Both need Python 3.12+ with `esphome==2026.9.1` importable (imports only, no
`esphome config`/`compile`/codegen).

## Reduced local coverage

```bash
python scripts/check_code.py --skip-sdk-checks
```

This is **reduced coverage, not a pass**. It skips the exact pinned-dependency
check and both generated-freshness checks. It still runs host, Python, web,
typecheck, bundle and diff checks. Use it only when Python ≥ 3.12 or the pinned
dependencies are unavailable, and say so in the PR that relies on it — CI always
runs the full gate.

## Manual and legacy validators

* `esphome config dev.yaml` / `esphome compile dev.yaml` — real ESPHome
  validation and compilation on a build host, with your own toolchain. Neither
  runs in CI, and neither is needed for the code gate.
* `python scripts/validate.py --config-only` — isolated real YAML validation
  (no codegen/compile) for both targets, exposed/all-internal entity profiles,
  web-server omission and web-v3/digest options, plus default/all/built-in fonts.
* `python scripts/validate.py [--compile] [--workspace DIR]` — isolated
  validator: copies only `packages/` and `fonts/`, writes deterministic fake
  secrets, keeps build artifacts under ignored `validation-tmp/`. `--compile`
  adds default/all-font ESP8266 builds and fails on any error.
* `./scripts/validate.ps1` (Windows) — tests plus `esphome config` in a
  temporary directory with fake secrets; `-Compile` and `-Remote` add the
  firmware build and the published example.
* `scripts/validate-release-offline.sh [tag]` — the release code path with a
  tagged local clone and a local HTTP font server. **It copies the whole working
  tree** (`.git`, `.esphome`, `.tmp` and `__pycache__` excluded), so never run it
  with a production `secrets.yaml` present. Migration is tracked in
  [ROADMAP.md](ROADMAP.md).

## What CI never verifies

* Firmware compilation, link, flash or RAM size — no ESPHome/PlatformIO CLI is
  invoked; the code gate only imports the SDK.
* `esphome config`/codegen for `dev.yaml` or an installer YAML (the generator
  inspects schema APIs, it does not validate a whole configuration).
* Anything on a device: readability, animation, wiring/orientation, boot splash,
  preference restore, encrypted OTA progress.
* Browser automation; no headless browser is used.
* Live GitHub behaviour beyond the publish/site/deploy jobs of a main push
  (see [RELEASING.md](RELEASING.md)); release and Pages checks are covered by
  mocked tests and by those jobs themselves.

## Evidence rules

* Report the exact command, commit, date, Python/Node version and result.
* Historical measurements are dated and must stay dated: the ESP8266 flash/RAM
  table in [packages/fonts/README.md](packages/fonts/README.md) was measured
  with ESPHome **2026.9.0** at release `0.4.0` (2026-09-30) and does not
  describe the current source.
* Mark anything without a dated measurement **Unverified** — see the open items
  in [ROADMAP.md](ROADMAP.md).
