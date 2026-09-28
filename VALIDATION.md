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
is cloneable, that both web fonts download, that the configuration is valid and
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
| Release path (offline) | `scripts/validate-release-offline.sh` | the released example fetches its packages from a tagged git repository and both fonts over HTTP, config valid, C++ generated with the package headers |
| Remote example | `./scripts/validate.ps1 -Remote` | the published example fetches its packages and fonts from GitHub (needs network) |

All steps return a non-zero exit code on failure, so they can be used in CI.

## Offline and sandboxed validation

Fonts are downloaded at build time. `scripts/validate-release-offline.sh` does
this automatically; by hand it is:

1. tag a copy of the repository (`cp -r` the checkout, `git init`, `git add -A`,
   `git commit`, `git tag 0.1.0`),
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
  `git tag 0.1.0 && git push origin 0.1.0` (see `VALIDATION.md` evidence for the
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

## Evidence from the sandboxed run

The following was executed while building the packages (ESPHome 2026.9.0):

| Check | Result |
|---|---|
| **Released example fetched from GitHub** (`ref:` = the pushed session branch, fonts over local HTTP) | `INFO Cloning https://github.com/sandro-defender/Esphome-Max7219-Matrix-Clock@...`, **`INFO Configuration is valid!`**, `main.cpp` generated (2955 lines) with both package headers copied into the build `src/` |
| `esphome config dev.yaml` (all modules, local fonts) | `INFO Configuration is valid!` |
| Code generation for the full config | `main.cpp` generated (2948 lines), headers included, fonts instantiated, display writer wired, action strings generated |
| **Release path** (`scripts/validate-release-offline.sh 0.1.0`) | packages cloned at tag `0.1.0`, both web fonts downloaded, `INFO Configuration is valid!`, `main.cpp` generated (2955 lines) |
| Package-relative C++ includes inside a remote package | `esphome: includes:` resolves to `<package cache>/packages/max7219_clock_renderer.h`, and both headers are copied into the build `src/` directory and `#include`d |
| OTA screen wiring in generated C++ | `UpdateComponentAction<>(matrix)` on `on_begin`/`on_end`/`on_error` and `matrix->update()` inside `on_progress`, guarded by the percentage change |
| Renderer unit tests (`g++ -std=c++17`) | 168 checks, 0 failures |
| Contract tests (`python tests/test_config.py`) | 25 tests, OK |
| Font metrics (freetype, ESPHome's own `pt_to_px()` math) | Tiny5 size 10: `HH:MM:SS` = 46 px; Press Start 2P size 6: 48 px; built-in 5×7 font: 42 px |
| **Full firmware compile** | **not executed**: the PlatformIO registry (`dl.registry.platformio.org`) is unreachable from the build sandbox, so the ESP8266 toolchain cannot be installed |

## Hardware-only checks that remain

These cannot be verified without a real clock and are intentionally listed as
open items in `ROADMAP.md`:

1. Full compile + flash/RAM measurement with `esphome compile` (a working
   PlatformIO network is required) and the firmware size headroom review.
2. On-panel readability of both fonts at 8 pixels high.
3. OTA upload with the progress screen: does the MAX7219 redraw during the
   upload (the callbacks call `id(matrix).update()` directly)?
4. Wiring, orientation and both test patterns on the real matrix.
5. Button/switch behaviour on hardware (display power, inversion, night
   brightness).
