# Optional release fonts (staged 0.4.0)

Each YAML owns one web font declaration, one compiler feature flag, and one
`!extend clock_font` option. Installers list these files explicitly, after the
core packages. `fonts_web.yaml` is only a convenience wrapper for the default
Matrix 2px + Dot Matrix pair; it no longer compiles all ten faces.
`fonts_local.yaml` retains the full local catalogue for development, metrics and
glyph generation. Do not include both the wrapper and its individual faces.

## Why this merge design

Official references (checked against the **2026.9.0** tag):

- [Packages / Extend](https://esphome.io/components/packages/#extend)
- [Core build_flags](https://esphome.io/components/esphome/#configuration-variables)
- [merge_config](https://github.com/esphome/esphome/blob/2026.9.0/esphome/config_helpers.py)
- [resolve_extend_remove](https://github.com/esphome/esphome/blob/2026.9.0/esphome/config.py)
- [template select restoration](https://github.com/esphome/esphome/blob/2026.9.0/esphome/components/template/select/template_select.cpp)

`!extend` **does append options**: string lists concatenate. Scalar lambdas
**replace**, so packages must not try to append lambda text. Each face adds
`-DMAX7219_FONT_*` via `esphome.build_flags`; the display's corresponding guarded
block wraps the generated font pointer and selects it by name. Raw pointers,
not `id()` expressions, are intentional: the preprocessor removes absent faces
without ESPHome trying to resolve their IDs first. `SourceFont` is guarded by
`USE_FONT`, so a built-in-only build needs no font namespace. The built-in
fallback and reset option are always available.

The official tag's unmodified merge/extend function definitions were exercised
in isolation over all 1024 subsets: options concatenate correctly and initial
choices remain present. This is **not** full ESPHome configuration validation.
Offline contracts also cover all subsets and host C++ syntax checks cover zero,
each individual face, the default pair, five faces and all ten (ESPHome stubs).
`test_exact_esphome_font_option_merge` repeats the resolver checks when exactly
2026.9.0 is installed (otherwise explicitly skipped).
Full codegen, include order, pointer visibility and compiler flag propagation
remain to be verified in exact ESPHome builds.

## Selection and restoration

The web UI always includes Matrix 2px + Dot Matrix and permits up to three
extras in catalogue order. Firmware modules support zero/one/all faces for
manual development tests, independently of that UI limit. The base select is
Compact 5x7; the Dot Matrix package changes its initial option to Dot Matrix.
A generated install can override the initial option to any included face.

ESPHome saves a **numeric index**. The web order keeps Compact, Matrix 2px and
Dot Matrix stable, but changing extras may remap a saved extra index to another
included face. Out-of-range indices use initial_option. Older all-font builds
have a different order too: reselect your desired font after flashing.
No restored option can reference an omitted font; the renderer still defaults
to Compact for any unmatched string. Restore display defaults selects Compact.

## Release gate and measurement

0.4.0 is a reserved draft, not a published release. `examples/release.yaml`,
project version and font asset refs are synchronized to that draft.
`INSTALLER_READY` remains false. Before enabling export, validate exact
ESPHome 2026.9.0 config and full ESP8266 builds for zero, one, default two,
maximum five and full ten faces, record RAM/flash, publish the approved tag and
verify a clean remote fetch. Then remove draft banners and enable export in
one tested release increment. Do not point these paths at 0.3.0.

No new font files were added; source notices remain in `fonts/*/OFL.txt`.
Matrix 2px and Dot Matrix are project-generated faces. Current default/one-face
firmware-size deltas are **unmeasured**. Older aggregate figures do not establish
headroom for this change.
