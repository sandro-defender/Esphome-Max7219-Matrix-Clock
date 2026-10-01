# Validation

## Active code-only continuation — 2026-10-02

Per the user's latest instruction, **do not invoke ESPHome config, build,
compile or code generation**, and do not retry toolchain downloads. Update the
existing draft PR after each finished source-code step. The firmware/toolchain
commands further below are historical/reproduction guidance, not commands to
run during this continuation.

Step 1 checks executed without ESPHome CLI:

- `python3 tests/test_publish_release.py`: **40 passed**, every external command
  mocked/blocked; no real GitHub publication or npm installer execution.
- Source contracts: **36 run, 35 passed, 1 skipped** because exact SDK is not
  installed in this environment. Do not claim that skipped merge check ran.
- `make -C tests test`: **315 checks passed**, host renderer only.
- Web suite: **103 passed** / **1,044 pixel-oracle frames**; typecheck **PASS**.

Step 2 adds **15 workflow/code-gate tests**, `validate-code.yml` and the
code-only runner. Local execution with `--skip-sdk-checks` passes **91 Python
tests run / 90 passed / 1 SDK skip**, **315 host checks**, **103 web tests**,
typecheck, production **web** bundle and diff checks. SDK/generated freshness
were not rerun locally; the new full CI runner requires exact pinned imports.

### Current code-only commands

With Python 3.12 and `requirements-validation.txt` installed, plus `npm ci`:

```bash
python scripts/check_code.py              # SDK imports/freshness only; no firmware CLI
# Explicit reduced local coverage when the exact SDK is not installed:
python scripts/check_code.py --skip-sdk-checks
```

The runner cannot call ESPHome/PlatformIO CLI or the firmware validator. A
local reduced PASS does not claim SDK freshness, config/codegen or compilation.
The CI workflow runs the full code gate with read-only permissions on all main
pushes and PRs; it never publishes/deploys. Hosted execution is not yet verified.

Firmware config/codegen/full build measurements have not been rerun. Prior
checkpoint results below retain their original scope/date.

## Earlier candidate checkpoint — 2026-10-02

Target **ESPHome 2026.9.1 exactly** on Python 3.12–3.14. Candidate `0.7.0` is
unreleased. Use the isolated Python validator for current firmware and browser
installer checks: it copies only selected source directories, excludes
`secrets.yaml`, creates deterministic fake secrets and keeps build output out
of the source tree. Production secrets were not opened or copied.

### Reproduce the available checks

```bash
python3.12 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements-validation.txt
npm --prefix web-configurator ci
python scripts/generate_firmware_contract.py --check
python web-configurator/scripts/generate_glyphs.py --check
make -C tests test
python tests/test_config.py
npm --prefix web-configurator test
npm --prefix web-configurator run typecheck
npm --prefix web-configurator run build
python scripts/validate.py --workspace validation-tmp/checkpoint-yaml
# On a build host with available PlatformIO/toolchain downloads:
python scripts/validate.py --compile
```

`--check` fails on stale generated source; regeneration is an intentional source
change, not a substitute for checking. The YAML validator runs real config and
C++ code generation for default two-font, all-font and built-in-only firmware,
plus default/custom-all-font YAML from the actual browser generator. It localizes
remote endpoints for isolation; it does **not** prove the candidate is published
or that remote release assets fetch. `--compile` also links default/all-font
ESP8266 firmware; without it, a PASS is **not a firmware compile**.

### Executed checks

| Command / evidence | Current result |
| --- | --- |
| `make -C tests test` | **315 checks, 0 failures** |
| `.venv/bin/python tests/test_config.py` | **36 tests, OK, no skips** |
| `npm --prefix web-configurator test` | **103 passed** |
| Browser/C++ tagged pixel oracle | **1,044 frame comparisons**, 9 parity tests |
| `npm --prefix web-configurator run typecheck` | **PASS** |
| `npm --prefix web-configurator run build` | **PASS** |
| Both generated-source `--check` commands | **PASS** |
| `scripts/validate.py --workspace validation-tmp/checkpoint-yaml` | **5 YAML configs + 5 C++ generations passed**, ESPHome 2026.9.1 |
| Earlier full default ESP8266 compile attempt | **BLOCKED**, exit 1 during PlatformIO toolchain acquisition |

Full-build log: ignored local `validation-tmp/local/compile.log`. The failure
was `SSLEOFError(UNEXPECTED_EOF_WHILE_READING)` / `HTTPClientError` while
installing `platformio/espressif8266@4.2.1`; there is no linked current firmware
or flash/RAM measurement. Current recheck logs are ignored under
`validation-tmp/checkpoint-logs/` and `validation-tmp/final-checkpoint-yaml/`.

### Not yet verified

- Default/all-font full ESP8266 builds and current flash/RAM headroom.
- Safe CI migration and all-main validation → immutable release → matching
  Pages deployment. `scripts/publish_release.py` is preparatory and not
  publication-tested or workflow-wired.
- Live release/tag/installer asset fetch and live Pages smoke checks.
- Exhaustive stateful cycling/countdown/overlay timelines.
- Physical font/animation/rotation, installed-version boot and encrypted OTA
  visibility, including off/inverted/dim/night/alarm preferences.
- Manual keyboard/reduced-motion/small-screen usability. No browser automation
  was used.

### Legacy validators and historical evidence

The PowerShell/release-offline entry points and workflow commands below are
archived, **not the recommended candidate pipeline**. In particular,
`validate-release-offline.sh` copies the whole working tree: do not run it with
production secrets present. Safe migration and remote release verification are
open roadmap items. Prior release 0.2.0/0.3.0/0.4.0 binaries and measurements
used the original ESPHome 2026.9.0 toolchain and must not be relabelled as current
2026.9.1 results.

## Validation

Everything in this repository can be validated without hardware, and the
validator never touches your real `secrets.yaml`.

### Quick start

Windows PowerShell:

```powershell
./scripts/validate.ps1                 # tests + ESPHome YAML config validation
./scripts/validate.ps1 -Compile         # server only: also compile the ESP8266 firmware
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

### What each step covers

| Step | Command | Covers |
|---|---|---|
| Contract tests | `python tests/test_config.py` | `min_version`, modular layout, modern `api.actions`, encrypted OTA, complete entity set, 384-byte ESP8266 action strings, credential scan, release/font pinning, font widths |
| Renderer tests | `make -C tests test` | display state machine, OTA priority, layout, slide-up animation, scrolling, countdown, night brightness, `millis()` rollover |
| Config validation | `esphome config dev.yaml` | full ESPHome 2026.9.0 schema validation, package merge, local fonts, lambdas, actions |
| Firmware compile (server only) | `esphome compile dev.yaml` | generated C++ compiles and links for ESP8266 (PlatformIO toolchain) |
| Release path (offline) | `scripts/validate-release-offline.sh` | the released example fetches its packages from a tagged git repository and all fonts over HTTP, config valid, C++ generated with the package headers |
| Configurator preview build | `python web-configurator/scripts/generate_glyphs.py --check` | the committed preview bitmaps still match the fonts and sizes the firmware compiles |
| Remote example | `./scripts/validate.ps1 -Remote` | the published example fetches its packages and fonts from GitHub (needs network) |

All steps return a non-zero exit code on failure, so they can be used in CI.

### Offline and sandboxed validation

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

### Caching, pinning and upgrades

* Remote packages and downloaded fonts are cached under `.esphome/packages/`
  and `.esphome/font/` next to your YAML file.
* `ref:` pins the package files, `project_ref` pins the font URLs and
  `project_version` in `packages/base.yaml` names the release. All three must
  stay identical: `tests/test_config.py` fails when they drift apart, and the
  release example must never use `@main`.
* The tag must exist in the repository before the example can be used:
  `git tag 0.4.0 && git push origin 0.4.0` (see `VALIDATION.md` evidence for the
  tested tag).
* `refresh:` controls how often the cache is re-checked (`refresh: 1d` in the
  release example, `refresh: 0s` while developing the packages).
* To upgrade: change `ref:` and `project_ref` in your YAML, run
  `esphome compile`, and let the cache refresh. To force a refresh immediately,
  delete `.esphome/packages/` and rebuild.
* Fonts are compiled into the firmware: the Home Assistant font selector
  switches between compiled font IDs and never touches the network at runtime.

### Secrets

* Every credential lives behind `!secret` in *your* YAML and reaches the
  packages as a substitution (`wifi_ssid: !secret wifi_ssid`).
* Remote packages cannot resolve `!secret`, which is why no package file
  contains one - enforced by `tests/test_config.py`.
* `secrets.yaml` is git-ignored; `secrets.yaml.example` contains placeholders
  only. The credential scan in the test suite fails if a literal secret shows up
  in a tracked file.

### Evidence from the 0.2.0 sandboxed run

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

### Evidence from the Matrix 2px change (2026-09-29)

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

### Hardware-only checks that remain

These cannot be verified without a real clock and are intentionally listed as
open items in `ROADMAP.md`:

1. On-panel readability of the six default 8-row fonts.
2. OTA upload with the progress screen: does the MAX7219 redraw during the
   upload (the callbacks call `id(matrix).update()` directly)?
3. Wiring, orientation and both test patterns on the real matrix.
4. Button/switch behaviour on hardware (display power, inversion, night
   brightness).

### Evidence for 0.4.0 (2026-09-30, Python 3.12.7 + ESPHome 2026.9.0)

Executed in a Linux sandbox with Python 3.12.7, `esphome==2026.9.0`, and the
ESP8266 Arduino 3.1.2 (`3.30102.0`) / `toolchain-xtensa` GCC 10.3.0
(`2.100300.220621`) build environment. The default two-face configuration
(`Matrix 2px` + `Dot Matrix` + built-in `Compact 5x7`) and subset configurations
were validated and compiled via local-font package equivalents (preserving
identical font IDs, sizes, `bpp: 1`, glyph sets, `-DMAX7219_FONT_*` build flags
and `!extend clock_font` options / `initial_option: "Dot Matrix"`), via
`scripts/validate-release-offline.sh 0.4.0` (tagged local git repository + local
HTTP font server), and via a clean remote configuration check cloning the
published `0.4.0` tag (`7c85cc49ec9c01c08adc26be9b2905ed85b9bd96`) directly from
GitHub:

| Check | Result |
|---|---|
| Contract tests (`python tests/test_config.py`, Python 3.12.7 + ESPHome 2026.9.0) | **34 tests, 0 skips, OK** — includes `test_exact_esphome_font_option_merge` exercising ESPHome 2026.9.0's `merge_config` and `resolve_extend_remove` across all 1,024 font subsets and the default two-face release order |
| Renderer unit tests (`make -C tests test`) | **245 checks, 0 failures** |
| Preview glyph check (`python web-configurator/scripts/generate_glyphs.py --check`) | **`glyphs.generated.ts is up to date`** |
| Web configurator (`npm test`, `npm run typecheck`, `npm run build`) | **71 tests pass** across 5 test files, clean `tsc --noEmit`, single-file `dist/index.html` |
| Default two-face config (`esphome config` + `esphome compile`, `Matrix 2px` + `Dot Matrix` + `Compact 5x7`) | **`INFO Configuration is valid!`** (`clock_font` options `["Compact 5x7", "Matrix 2px", "Dot Matrix"]`, `initial_option: "Dot Matrix"`), **`INFO Successfully compiled program.`** (`main.cpp` 3,012 lines) |
| Offline release path (`scripts/validate-release-offline.sh 0.4.0`) | **PASS**: packages cloned at tag `0.4.0`, **2 default web fonts** downloaded (`matrix-2px/Matrix2px.ttf`, `dot-matrix/DotMatrix.ttf`), config valid, `main.cpp` generated (3,018 lines), headers copied, `compile exit code: 0` |
| **Live remote `0.4.0` tag check** (`esphome config` cloning `https://github.com/sandro-defender/Esphome-Max7219-Matrix-Clock@0.4.0`) | **`INFO Cloning https://github.com/sandro-defender/Esphome-Max7219-Matrix-Clock@0.4.0`**, **`INFO Configuration is valid!`**, `main.cpp` generated (3,018 lines) with both package headers (`max7219_clock_esphome.h`, `max7219_clock_renderer.h`) copied into the build `src/` directory and both tagged web fonts downloaded |
| Full 10-face local catalogue (`esphome config dev.yaml` + `esphome compile dev.yaml`) | **`INFO Configuration is valid!`**, **`INFO Successfully compiled program.`** (`main.cpp` 3,182 lines) |

#### Measured ESP8266 flash and RAM usage (ESPHome 2026.9.0, `d1_mini`)

| Configuration | External faces | `Clock font` options | Flash used / 1,044,464 B | Flash delta vs 0 faces | RAM used / 81,920 B | RAM delta vs 0 faces |
|---|---:|---|---:|---:|---:|---:|
| Built-in only (`zero_faces`) | 0 | `Compact 5x7` | 501,589 B (48.0%) | — | 40,088 B (48.9%) | — |
| Single face (`Matrix 2px`) | 1 | `Compact 5x7`, `Matrix 2px` | 504,085 B (48.3%) | +2,496 B | 40,676 B (49.7%) | +588 B |
| Single face (`Dot Matrix`) | 1 | `Compact 5x7`, `Dot Matrix` | 504,101 B (48.3%) | +2,512 B | 40,676 B (49.7%) | +588 B |
| **Default release pair (`Matrix 2px` + `Dot Matrix`)** | **2** | **`Compact 5x7`, `Matrix 2px`, `Dot Matrix` (initial: `Dot Matrix`)** | **505,141 B (48.4%)** | **+3,552 B (+1,040 B vs 1 face)** | **41,276 B (50.4%)** | **+1,188 B (+600 B vs 1 face)** |
| Max configurator subset (default 2 + 3 extras: `Jersey 15`, `Teko`, `Rajdhani Bold`) | 5 | `Compact 5x7`, `Matrix 2px`, `Dot Matrix`, `Jersey 15`, `Teko`, `Rajdhani Bold` | 507,181 B (48.6%) | +5,592 B (+2,040 B vs default 2) | 43,012 B (52.5%) | +2,924 B (+1,736 B vs default 2) |
| Full local catalogue (`dev.yaml`, `packages/fonts_local.yaml`) | 10 | `Compact 5x7` + all 10 external faces | 510,589 B (48.9%) | +9,000 B (+5,448 B vs default 2) | 45,964 B (56.1%) | +5,876 B (+4,688 B vs default 2) |

* The **default two-face configuration** leaves **51.6% flash (539,323 B)** and
  **49.6% RAM (40,644 B)** free on the ESP8266, saving **5,448 B flash** and
  **4,688 B RAM** compared with compiling all ten external faces in `dev.yaml`.
* Even with the maximum three optional extras selected in the web configurator
  (five external faces total), **51.4% flash** and **47.5% RAM** remain free.
* Tag and GitHub release `0.4.0` are published and verified via remote fetch,
  and `INSTALLER_READY` is `true` with draft warnings removed. Interactive
  browser keyboard/mobile checks remain open in this sandbox because no browser
  binary is installed and Playwright browser downloads are blocked by the
  sandbox network policy.
