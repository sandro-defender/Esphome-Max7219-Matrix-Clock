# Package modules

The firmware is split into small modules. A user YAML declares substitutions and
the package list; everything else lives here.

| Module | Contents |
|---|---|
| `base.yaml` | device identity, `min_version: "2026.9.1"`, project metadata (`project_ref`), ESP8266 board, boot defaults, logger, all substitution defaults |
| `network.yaml` | Wi-Fi (with fallback access point), encrypted native API, Home Assistant time and SNTP fallback, both using `${timezone}` |
| `renderer.yaml` | C++ include list, restore-defaults script, OTA error/success timeouts |
| `display.yaml` | SPI bus, MAX7219 panel, the lambda that feeds the renderer and publishes changes |
| `fonts/*.yaml` | five per-face release packages (`type: web`, `-DMAX7219_FONT_*`, `!extend clock_font`) |
| `fonts_web.yaml` | wrapper for the default pair: Pixel Clock 6×8 + Matrix 2px |
| `fonts_default_local.yaml` | generated local wrapper for the same default pair, used by `dev.yaml` |
| `fonts_local.yaml` | generated five-face catalogue for offline metrics and glyph generation |
| `local_fonts/*.yaml` | generated local equivalents of the five face packages |
| `controls.yaml` | selects, numbers, switches and buttons exposed to Home Assistant |
| `actions.yaml` | `api.actions` (`show_message`, `clear_message`, `start_countdown`, `cancel_countdown`, `show_status`, `get_status`) and the shared button scripts |
| `diagnostics.yaml` | Wi-Fi/uptime/heap/version diagnostics plus display-mode, OTA-state and countdown sensors |
| `ota_ui.yaml` | encrypted native OTA platform and the on-screen upload status callbacks |
| `boot_ui.yaml` | installed-version splash at boot |
| `web_server.yaml` | optional browser UI with mandatory authentication and `ota: false` |
| `configurator.json` | UI bindings only (labels, groups, input kinds); defaults/options/entities are generated from the YAML above |
| `max7219_clock_renderer.h` | display state machine, layout, slide-up animation, scrolling, countdown and OTA screens (pure C++17, host-testable) |
| `max7219_clock_esphome.h` | adapters between the renderer and ESPHome's display/font components |

Generated files: `restore_defaults.generated.yaml`, `fonts_default_local.yaml`,
`fonts_local.yaml`, `local_fonts/*.yaml` and `examples/*.yaml` come from
`scripts/generate_firmware_contract.py`; never edit them by hand
([AGENTS.md](../AGENTS.md)).

## How a user YAML loads them

`examples/release.yaml` (generated, pinned to the version tag in
`base.yaml` — the plain `X.Y.Z` that the last main-push run published):

```yaml
packages:
  clock:
    url: https://github.com/sandro-defender/Esphome-Max7219-Matrix-Clock
    ref: "0.7.2"
    refresh: 1d
    files:
      - packages/base.yaml
      # ... one entry per module, plus the selected font faces
```

The explicit `url` + `files` form is used instead of the `github://` shorthand
because only this form can (a) pin a `ref`, (b) load several YAML files as one
package and (c) ship the two C++ headers with it. ESPHome clones the whole
repository at `ref`, so relative `!include`s and `esphome: includes:` inside the
modules resolve against `packages/` in the clone. `dev.yaml` uses the same
modules through `!include` for local work.

Public installers must pin a published immutable tag, never `main`; the tags come
only from the main-push workflow ([RELEASING.md](../RELEASING.md)).

## Rules for every module

* Keep credentials out: use `${substitution}` names, never `!secret`. Remote
  packages cannot resolve `!secret`; the user YAML resolves it and passes the
  value down.
* Give every component a stable, unique `id`; other modules refer to them.
* Put tunable defaults in `substitutions:` and let the user YAML override them
  (user substitutions win over package substitutions).
* Prefer `type: web` font sources in released modules; the `*_local` wrappers
  exist only for offline development and metrics.
* Keep module lists in sync with `dev.yaml` and the generated examples;
  `tests/test_config.py` fails when they drift.
* Update the package table above and [packages/fonts/README.md](fonts/README.md)
  when the module or font set changes.

## Renderer interface

`max7219_clock_renderer.h` is ESPHome-free by design:

```cpp
max7219_clock::Frame frame;      // time + entity state + timings
max7219_clock::render(canvas, selected_font, builtin_font, frame, report);
if (report.mode_changed) { ... }  // publish only what changed
```

`max7219_clock::state` holds temporary runtime state (message, alert, countdown,
OTA progress) in RAM only; durable preferences stay in the restored template
entities. `tests/test_renderer.cpp` and `tests/renderer_fixture.cpp` cover the
renderer on the host (`make -C tests test fixture`).

## Font subsets

Default build: Pixel Clock 6×8 + Matrix 2px, with Compact 5×7 always built in.
Dot Matrix, MD Parola Numeric 7-Segment and MD MAX72XX System are optional and
individually selectable without a cap. See
[font package design and validation](fonts/README.md).
