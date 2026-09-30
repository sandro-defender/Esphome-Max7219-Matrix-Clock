# Package modules

The firmware is split into small modules. A user YAML only declares
substitutions and the package list; everything else lives here.

| Module | Contents |
|---|---|
| `base.yaml` | device identity, `min_version: "2026.9.0"`, project metadata, ESP8266 board, boot defaults, logger, substitution defaults |
| `network.yaml` | Wi-Fi (with fallback access point), encrypted native API, Home Assistant + SNTP time sources |
| `renderer.yaml` | C++ include list for the renderer, restore-defaults script, OTA error/success timeouts |
| `display.yaml` | SPI bus, MAX7219 panel, the small lambda that feeds the renderer and publishes changes |
| `fonts/*.yaml` | ten per-face release packages (`type: web`, `-DMAX7219_FONT_*`, `!extend clock_font`) |
| `fonts_web.yaml` | convenience wrapper for the default Matrix 2px + Dot Matrix release pair (`type: web`, pinned to `${project_ref}`) |
| `fonts_local.yaml` | all ten 8-row faces read from `fonts/` in the checkout (development/offline metrics and glyph generation) |
| `controls.yaml` | selects, numbers, switches and buttons exposed to Home Assistant |
| `actions.yaml` | `api.actions` (`show_message`, `clear_message`, `start_countdown`, `cancel_countdown`, `show_status`, `get_status`) and the scripts shared with the buttons |
| `diagnostics.yaml` | Wi-Fi/uptime/heap/version diagnostics plus the display-mode, OTA-state and countdown sensors |
| `ota_ui.yaml` | encrypted native OTA platform and the on-screen upload status callbacks |
| `web_server.yaml` | optional browser UI with mandatory authentication and `ota: false` |
| `max7219_clock_renderer.h` | display state machine, layout, slide-up animation, scrolling, countdown and OTA screens (pure C++17, host-testable) |
| `max7219_clock_esphome.h` | thin adapters between the renderer and ESPHome's display/font components |

## How a user YAML loads them

Release example (`examples/release.yaml`) - pinned tag:

```yaml
packages:
  clock:
    url: https://github.com/sandro-defender/Esphome-Max7219-Matrix-Clock
    ref: "0.4.0"
    refresh: 1d
    files:
      - packages/base.yaml
      # ... one entry per module
```

The explicit `url` + `files` form is used instead of the `github://` shorthand
because only this form can (a) pin a `ref`, (b) load several YAML files as one
package and (c) ship the two C++ headers with it. ESPHome clones the whole
repository at `ref`, so relative `!include`s and `esphome: includes:` inside the
modules resolve against `packages/` in the clone - verified by generating C++
from a tagged clone (`VALIDATION.md`).

Local development (`dev.yaml`) uses the same modules through `!include`, so
nothing has to be committed or pushed to test a change.

## Rules for every module

* Keep credentials out: use `${substitution}` names, never `!secret`.
  Remote packages cannot resolve `!secret`; the user YAML resolves it and passes
  the value down.
* Give every component a stable, unique `id`; other modules refer to them.
* Put tunable defaults in `substitutions:` and let the user YAML override them
  (user substitutions win over package substitutions).
* Prefer `type: web` font sources in released modules; `fonts_local.yaml` exists
  only for offline development.
* Update `examples/release.yaml`, `examples/development.yaml` and `dev.yaml`
  together - `tests/test_config.py` fails when the module lists drift apart.

## Renderer interface

`max7219_clock_renderer.h` is ESPHome-free by design:

```cpp
max7219_clock::Frame frame;      // time + entity state + timings
max7219_clock::render(canvas, selected_font, builtin_font, frame, report);
if (report.mode_changed) { ... }  // publish only what changed
```

`max7219_clock::state` holds temporary runtime state (message, alert, countdown,
OTA progress) in RAM only; durable preferences stay in the restored template
entities. The renderer is covered by `tests/test_renderer.cpp`
(`make -C tests test`), which needs no ESPHome installation.

## Staged font subsets

The 0.4.0 draft lists individual `fonts/*.yaml` packages. Matrix 2px + Dot Matrix
are defaults; the configurator permits three extras. `fonts_web.yaml` wraps only
the default pair; `fonts_local.yaml` remains the complete developer catalogue.
See [font package design, restore semantics and release gate](fonts/README.md).
