# Validation

Everything in this repository can be validated without hardware, and the
validator never touches your real `secrets.yaml`.

## Quick start

Windows PowerShell:

```powershell
./scripts/validate.ps1                 # tests + config + full ESP8266 compile
./scripts/validate.ps1 -SkipCompile    # faster: tests + config validation only
./scripts/validate.ps1 -SkipInstall    # reuse the virtual environment of the last run
./scripts/validate.ps1 -Remote         # additionally validate examples/release.yaml
```

Linux/macOS (the same steps, run by hand):

```bash
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements-validation.txt          # esphome==2026.9.0
python tests/test_config.py                         # offline contract tests
make -C tests test                                  # pure C++ renderer tests
esphome config dev.yaml                             # ESPHome config validation
esphome compile dev.yaml                            # full ESP8266 firmware compile

scripts/validate-release-offline.sh                 # release path, no network needed
```

`scripts/validate-release-offline.sh` is the strongest offline check of what
users actually get: it tags a snapshot of this checkout in a throw-away git
repository, serves `fonts/` over plain HTTP and runs the **released example**
with only those two endpoints redirected (the git repo replaces github.com, the
HTTP server replaces raw.githubusercontent.com). It asserts that the pinned tag
is cloneable, that every web font downloads, that the configuration is valid and
that C++ is generated with the package headers included and copied into the
build directory. It fails if `examples/release.yaml`, `packages/base.yaml` and
`packages/fonts_web.yaml` drift to different versions.

`scripts/validate.ps1` copies the repository files into a temporary directory,
writes a fake `secrets.yaml` there (obvious placeholder values, valid key
length), runs the steps and deletes only that directory again. Your real
`secrets.yaml` is never read, printed or modified.

## What each step covers

| Step | Command | Covers |
|---|---|---|
| Contract tests | `python tests/test_config.py` | `min_version`, modular layout, modern `api.actions`, encrypted OTA, complete entity set, 384-byte ESP8266 action strings, credential scan, release/font pinning, font widths |
| Renderer tests | `make -C tests test` | display state machine, OTA priority, layout, slide-up animation, scrolling, countdown, night brightness, `millis()` rollover |
| Config validation | `esphome config dev.yaml` | full ESPHome 2026.9.0 schema validation, package merge, local fonts, lambdas, actions |
| Firmware compile | `esphome compile dev.yaml` | generated C++ compiles and links for ESP8266 (PlatformIO toolchain) |
| Release path (offline) | `scripts/validate-release-offline.sh` | the released example fetches its packages from a tagged git repository and all fonts over HTTP, config valid, C++ generated with the package headers |
| Configurator preview build | `python web-configurator/scripts/generate_glyphs.py --check` | the committed preview bitmaps still match the fonts and sizes the firmware compiles |
| Remote example | `./scripts/validate.ps1 -Remote` | the published example fetches its packages and fonts from GitHub (needs network) |

All steps return a non-zero exit code on failure, so they can be used in CI.

## Offline and sandboxed validation

Fonts are downloaded at build time. `scripts/validate-release-offline.sh` does
this automatically; by hand it is:

1. tag a copy of the repository (`cp -r` the checkout, `git init`, `git add -A`,
   `git commit`, `git tag 0.2.0`),
2. serve the fonts (`cd fonts && python3 -m http.server 8799`),
3. take `examples/release.yaml`, point `url:` at the copy
   (`file:///path/to/copy`), keep `ref:`/`project_ref` at the tag, and override

```yaml
substitutions:
  fonts_base_url: http://127.0.0.1:8799       # replaces the raw GitHub URL
```

This exercises the real code path - git clone at the pinned ref, the `files:`
list, package-relative `includes:`, web-font download and caching - without
touching GitHub.

## Caching, pinning and upgrades

* Remote packages and downloaded fonts are cached under `.esphome/packages/`
  and `.esphome/font/` next to your YAML file.
* `ref:` pins the package files, `project_ref` pins the font URLs and
  `project_version` in `packages/base.yaml` names the release. All three must
  stay identical: `tests/test_config.py` fails when they drift apart, and the
  release example must never use `@main`.
* The tag must exist in the repository before the example can be used:
  `git tag 0.2.0 && git push origin 0.2.0` (see `VALIDATION.md` evidence for the
  tested tag).
* `refresh:` controls how often the cache is re-checked (`refresh: 1d` in the
  release example, `refresh: 0s` while developing the packages).
* To upgrade: change `ref:` and `project_ref` in your YAML, run
  `esphome compile`, and let the cache refresh. To force a refresh immediately,
  delete `.esphome/packages/` and rebuild.
* Fonts are compiled into the firmware: the Home Assistant font selector
  switches between compiled font IDs and never touches the network at runtime.

## Secrets

* Every credential lives behind `!secret` in *your* YAML and reaches the
  packages as a substitution (`wifi_ssid: !secret wifi_ssid`).
* Remote packages cannot resolve `!secret`, which is why no package file
  contains one - enforced by `tests/test_config.py`.
* `secrets.yaml` is git-ignored; `secrets.yaml.example` contains placeholders
  only. The credential scan in the test suite fails if a literal secret shows up
  in a tracked file.

## Evidence from the 0.2.0 sandboxed run

The following was executed while building release 0.2.0 (ESPHome 2026.9.0).
It is retained as historical evidence; the 0.3.0 five-font change still needs
the complete validation sequence above before publication.

| Check | Result |
|---|---|
| **Released example fetched from GitHub** (`ref:` = the pushed session branch, fonts over local HTTP) | `INFO Cloning https://github.com/sandro-defender/Esphome-Max7219-Matrix-Clock@...`, **`INFO Configuration is valid!`**, `main.cpp` generated (2955 lines) with both package headers copied into the build `src/` |
| `esphome config dev.yaml` (all modules, local fonts) | `INFO Configuration is valid!` |
| Code generation for the full config | headers included, all 33 fonts instantiated, display writer wired, action strings generated |
| **Release path** (`scripts/validate-release-offline.sh 0.2.0`) | **PASS**: packages cloned at tag `0.2.0`, all 33 web fonts downloaded, config valid, `main.cpp` generated (3860 lines) |
| Package-relative C++ includes inside a remote package | `esphome: includes:` resolves to `<package cache>/packages/max7219_clock_renderer.h`, and both headers are copied into the build `src/` directory and `#include`d |
| OTA screen wiring in generated C++ | `UpdateComponentAction<>(matrix)` on `on_begin`/`on_end`/`on_error` and `matrix->update()` inside `on_progress`, guarded by the percentage change |
| Renderer unit tests (`make -C tests test`, `g++ -std=c++17`) | 179 checks, 0 failures |
| Contract tests (`python tests/test_config.py`) | 30 tests, OK (native renderer case skipped only because no host C++ compiler is installed; the ESP8266 compiler passed below) |
| Font metrics (freetype, ESPHome's own advance math) | all 33 external faces fit worst-case `88:88:88` in 48×8; Georgian faces compile all Mkhedruli and Mtavruli letters |
| Font wiring (`tests/test_config.py`) | every font in `fonts_local.yaml` has a `Clock font` option, is instantiated and selected, and compiles the RAM-safe glyph set |
| Configurator preview (`cd web-configurator && npm test`) | 43 tests: YAML generator, storage/share links, exact 34-option font catalogue, renderer behaviour, and static app rendering |
| Configurator build (`npm run build`) | single-file `dist/index.html`, 347.79 kB (102.93 kB gzip) |
| **Full firmware compile** (`scripts/validate.ps1`) | **PASS** with ESPHome 2026.9.0: 529709/1044464 bytes flash (50.7%), 63200/81920 bytes RAM (77.1%) |

## Evidence from the Matrix 2px change (2026-09-29)

Executed while adding the generated `fonts/matrix-2px` face and the renderer
fixes shipped alongside it, in a Linux sandbox with ESPHome 2026.9.0 on
Python 3.12:

| Check | Result |
|---|---|
| Contract tests (`python tests/test_config.py`) | **31 tests, OK** — including the new `test_matrix_2px_font_is_pixel_exact_with_two_pixel_lines`, which re-inks every glyph with ESPHome's own FreeType load flags and compares it to the design table |
| Renderer tests (`make -C tests test`) | **239 checks, 0 failures** (blink-colon layout stability, Latin message fallback, OTA fallback, built-in `+` glyph) |
| `esphome config dev.yaml` | **`INFO Configuration is valid!`** — all six local fonts compile, glyph sets complete |
| Release path (`scripts/validate-release-offline.sh 0.3.0`) | **PASS**: packages cloned at the pinned tag, **6 web fonts** downloaded (incl. `matrix-2px/Matrix2px.ttf`), config valid, `main.cpp` generated (3065 lines) with both package headers |
| ESPHome codegen inspection | the generated glyph table for `font_matrix_2px_source` shows digits `advance 7, offset 0/0, 6x8` and colon `advance 3, offset 0/1, 2x6` — pixel-identical to the design |
| Configurator (`npm test`, `npm run typecheck`, `npm run build`) | **45 tests pass**, clean type-check, single-file build; `generate_glyphs.py --check` reports fresh previews |
| Full firmware compile | **not runnable here**: the sandbox's network policy blocks `registry.platformio.org`, so the ESP8266 toolchain cannot be installed. Run `esphome compile dev.yaml` (or `scripts/validate.ps1`) on an unrestricted machine before release. |

## Hardware-only checks that remain

These cannot be verified without a real clock and are intentionally listed as
open items in `ROADMAP.md`:

1. On-panel readability of the six default 8-row fonts.
2. OTA upload with the progress screen: does the MAX7219 redraw during the
   upload (the callbacks call `id(matrix).update()` directly)?
3. Wiring, orientation and both test patterns on the real matrix.
4. Button/switch behaviour on hardware (display power, inversion, night
   brightness).
