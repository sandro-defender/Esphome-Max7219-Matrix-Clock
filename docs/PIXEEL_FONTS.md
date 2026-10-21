# Pixeel font integration

Pixeel is a browser pixel-font editor — open it at
<https://sandro-defender.github.io/Pixeel-font-editor/> (source:
<https://github.com/sandro-defender/Pixeel-font-editor>) — that can export a
MAX7219 clock face as a drop-in firmware package. This repository consumes
those exports in two ways:

* **Personal build** — compile *only* your font (custom slot). No catalogue
  change, no PR required.
* **Catalogue contribution** — add the face to `packages/fonts/` so everyone can
  select it.

Both paths are automated; no hand-editing of `packages/display.yaml` is needed.

> The shipped firmware and the six-face catalogue are untouched in this PR.
> The scripts modify the working tree at run time only. The custom slot uses
> `MAX7219_CUSTOM_FACE` / `font_custom_face` outside the guarded catalogue
> namespaces, so all 39 config tests, 127 `check_code` tests and 167 web
> configurator tests stay green with the slot installed.

## Quick links

* Font assets and licences: [fonts/README.md](../fonts/README.md)
* Package policy: [packages/fonts/README.md](../packages/fonts/README.md)
* Firmware contract: [AGENTS.md](../AGENTS.md)

## Contract summary (shared with Pixeel, v1)

`contractVersion` is `1`. All changes are additive. Consumers ignore unknown
files/fields and fall back to documented defaults for missing optional fields.

### C.1 — Export ZIP layout

File name: `<slug>-esphome-max7219.zip`, slug validated against
`^[a-z0-9]+(-[a-z0-9]+)*$`.

```
<slug>-esphome-max7219.zip
├── fonts/<slug>/<PostScriptName>.ttf        (exactly one .ttf under fonts/*/)
├── fonts/<slug>/LICENSE.txt
├── packages/fonts/<slug>.yaml               (web-type catalogue face package)
├── font-manifest.json
├── EXPORT-REPORT.md                         (contains **Status:** PASS or FAIL)
├── INTEGRATION.md
└── integration/
    ├── configurator-fontMetadata.json       ({"<slug>": {"label","license","source"}})
    ├── display-snippet.txt                  (4 lines: #ifdef/SourceFont/if-selected/#endif, unindented)
    ├── test-mapping.txt                     (one line:  "<firmwareId>": "<label>",)
    └── fonts-readme-row.md                  (one Markdown table row)
```

`packages/fonts/<slug>.yaml` shape:

```yaml
font:
  - id: font_<slug_us>_source
    file: {type: web, url: '${fonts_base_url}/<slug>/<file>.ttf'}
    size: 8
    bpp: 1
    glyphs: ['<glyph string>']
esphome:
  build_flags: [-DMAX7219_FONT_<SLUG_US_UPPER>]
select:
  - id: !extend clock_font
    options: ['<label>']
```

`font-manifest.json` fields: `slug, label, familyName, firmwareId, macro, file,
size, bpp, glyphs, license, licenseFile, ttfSha256, measuredTestString
("88:88:88"), measuredTestStringWidthPx, tallestDigitPx, contractVersion (=1)`.

### C.2 — Font technical rules (validated in Pixeel)

Rendered at size 8, bpp 1 (ESPHome/FreeType). Tallest digit 0–9 exactly 8 px;
`"88:88:88"` advance ≤ 48 px; no ink clipped when the clock centres text on the
ink of `'0'`; for pixel-exact output `unitsPerEm = 8 × lattice`. Default glyph
set:

```
0123456789:.-/%!?+ აბგდევზთიკლმნოპჟრსტუფქღყშჩცძწჭხჯჰ
```

### C.3 — Custom slot (personal single-font build)

Installed by `scripts/use_pixeel_font.py`:

* Folder `custom/` at repo root containing exactly: `font.ttf`, `LICENSE.txt`,
  `font-info.json`, `custom_font.yaml`.
* `custom/custom_font.yaml`: font id `font_custom_face`, `file: {type: local,
  path: font.ttf}`, `size: 8`, `bpp: 1`, glyphs = export's glyph string
  (fallback: default set above), build flag `-DMAX7219_CUSTOM_FACE`, and
  `select: - id: !extend clock_font` with `options: ['<label>']` AND
  `initial_option: '<label>'` (clock boots into the custom face).
* `packages/display.yaml` patch (idempotent): inserted immediately before the
  `max7219_clock::render(canvas, *selected, ...)` anchor line, with the anchor's
  indentation:

```cpp
#ifdef MAX7219_CUSTOM_FACE
max7219_clock::SourceFont custom_face_font(font_custom_face, &it);
if (font_option == "<label>") selected = &custom_face_font;
#endif
```

* `dev-custom.yaml` at repo root: verbatim copy of `dev.yaml` with the single
  line `fonts: !include packages/fonts_default_local.yaml` replaced by
  `fonts: !include custom/custom_font.yaml`, plus a `GENERATED — do not edit`
  header.
* After any `packages/display.yaml` change the script re-runs
  `scripts/generate_firmware_contract.py`.

### C.4 — `font-info.json`

Written by both Pixeel (folder mode) and `use_pixeel_font.py`. Required:
`label` (string), `glyphs` (string). Optional:
`contractVersion, slug, sourceTtfName, ttfSha256, installedAt (UTC ISO-8601,
seconds), fontId ("font_custom_face"), macro ("MAX7219_CUSTOM_FACE"),
exportReportStatus ("PASS"|"FAIL"|"UNKNOWN")`, plus passthrough manifest fields.
Escaping: labels go into YAML single quotes (`'` → `''`) and C++ double quotes
(`"`/`\` escaped).

### C.5 — Folder mode

Pixeel can write §C.3's four files directly into any directory, e.g. `custom/`.
`scripts/use_pixeel_font.py --folder <dir>` ingests `font.ttf` + `font-info.json`
(label, glyphs) from that folder, regenerates `custom/*` canonically (its own
`custom_font.yaml` wins on conflict), and continues with the display patch /
`dev-custom.yaml` / contract regeneration.

## End-to-end workflows

### A. Export in Pixeel

1. Open the Pixeel editor, draw or import your 8-row face. Keep the design
   within §C.2 (8 px digits, ≤ 48 px for `88:88:88`).
2. Export → **MAX7219 Clock** → choose the slug, label, licence and glyph set.
   Pixeel validates the rules and writes `EXPORT-REPORT.md` with **Status:**
   `PASS` or `FAIL`.
3. Download either:
   * the ZIP (`<slug>-esphome-max7219.zip`), or
   * a folder export directly into your checkout's `custom/` (Pixeel's folder
     mode).

### B. Validate the export

* Open `EXPORT-REPORT.md`. `PASS` means the face fits the matrix; `FAIL`
  explains what clips or overflows. The clock scripts surface `FAIL` as a loud
  warning but do not block installation — verify readability on the device.
* Check `font-manifest.json` — `tallestDigitPx` must be 8 and
  `measuredTestStringWidthPx` ≤ 48.

### C. Personal single-font build

```bash
# ZIP mode (recommended)
python scripts/use_pixeel_font.py --zip ~/Downloads/my-font-esphome-max7219.zip

# TTF-only mode (no ZIP — provide label/glyphs manually)
python scripts/use_pixeel_font.py --ttf ~/my-font.ttf --label "My Font" --glyphs "0123456789: "

# Folder mode (Pixeel wrote directly into custom/ or any dir)
python scripts/use_pixeel_font.py --folder custom
python scripts/use_pixeel_font.py --folder /tmp/pixeel-export
# or with label override
python scripts/use_pixeel_font.py --zip my-font.zip --label "Renamed"
```

What happens:

* `custom/` is populated with `font.ttf`, `LICENSE.txt`, `font-info.json`,
  `custom_font.yaml`.
* `packages/display.yaml` gains (or updates) the `MAX7219_CUSTOM_FACE` block.
* `dev-custom.yaml` is created.
* `scripts/generate_firmware_contract.py` is re-run (unless `--no-generate`).

Then validate and flash:

```bash
# First time: create secrets.yaml (the script does this for --config/--flash,
# otherwise do it manually)
cp secrets.yaml.example secrets.yaml
# Fix api_encryption_key: esphome generate-encryption-key or let the script
# generate a random one — the example placeholder is NOT valid base64

pip install -r requirements-validation.txt   # esphome==2026.9.1 exactly

esphome config dev-custom.yaml   # expect: Configuration is valid!
esphome run dev-custom.yaml      # first flash over USB, later OTA

# Or let the script do it:
python scripts/use_pixeel_font.py --zip my-font.zip --config   # config only
python scripts/use_pixeel_font.py --zip my-font.zip --flash    # flash device
```

Re-running the script replaces the font/label/glyphs and never duplicates the
display block. `dev-custom.yaml` always boots into the custom face via
`initial_option`.

`custom/` and `dev-custom.yaml` are personal build artefacts — do not commit
them. To return to the stock checkout, restore `packages/display.yaml` and the
regenerated contract files (`git checkout -- .`) and delete `custom/`,
`dev-custom.yaml` and `secrets.yaml`.

### D. Catalogue contribution (maintainer path)

Use this when you want the face shipped to everyone.

```bash
python scripts/integrate_max7219_font.py --zip ~/Downloads/my-font-esphome-max7219.zip
# --no-generate to skip automatic regeneration / checks
```

Steps performed:

1. Copies `fonts/<slug>/` and `packages/fonts/<slug>.yaml` into the repo.
2. Applies the four `integration/` snippets:
   * `fontMetadata` entry into `packages/configurator.json` (preserves
     `json.dumps(indent=2, ensure_ascii=False)+"\n"` formatting);
   * `display-snippet.txt` indented to the render anchor in
     `packages/display.yaml`;
   * `test-mapping.txt` appended inside `FONT_OPTION_BY_ID` in
     `tests/test_config.py`;
   * `fonts-readme-row.md` appended as the last row of the Family table in
     `fonts/README.md`.
3. Runs in order:
   `scripts/generate_firmware_contract.py`,
   `web-configurator/scripts/generate_glyphs.py`,
   `scripts/check_code.py`.
   Pass `--no-generate` to skip this step.

All four snippets are idempotent (detected via macro / mapping line / metadata
key / README link). Adding a face also changes the catalogue size, so update
the face-count assertion in `tests/test_config.py`
(`assertEqual(len(faces), …)`) — and any face-specific height exceptions — to
match the new catalogue before expecting `check_code` to pass; the integrator
prints a warning when they disagree. Verify the same checks as above, then
open a PR with the updated catalogue files and regenerated assets.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `WARNING: EXPORT-REPORT.md reports **Status:** FAIL` | Pixeel validation failed: digit taller than 8 px, `88:88:88` > 48 px, or clipped ink. | Open `EXPORT-REPORT.md` for the exact measurement. Adjust the design in Pixeel and re-export. The script still installs the font but the clock may clip or degrade to the fallback. |
| `Firmware/configurator drift. Regenerate…` | `packages/display.yaml` or `dev.yaml` changed without re-running the generator. | `python scripts/generate_firmware_contract.py` and commit the regenerated files. `use_pixeel_font.py` does this automatically. |
| `Use exactly ESPHome 2026.9.1, installed …` | Wrong Python env. | `python3 -m venv .venv && .venv/bin/pip install -r requirements-validation.txt` and re-run with `.venv/bin/python`. |
| `Missing fontMetadata…` / `Missing font …` during `generate_firmware_contract.py` | Catalogue face installed without its `fontMetadata` entry or font asset. | Ensure `fonts/<slug>/LICENSE.txt` exists and `packages/configurator.json` contains the slug. The integrator script handles both; manual installs must add them. |
| `api_encryption_key` invalid base64 | `secrets.yaml.example` placeholder is not valid base64. | Generate a real key: `base64` of 32 random bytes (`esphome generate-encryption-key` or `python -c "import os,base64; print(base64.b64encode(os.urandom(32)).decode())"`). The script creates `secrets.yaml` with a valid dummy key when `--config`/`--flash` needs it. |
| `g++: error` / syntax check fails for custom slot | Custom label contains unescaped quotes. | The script escapes `'` → `''` for YAML and `"`/`\` for C++. Re-run `use_pixeel_font.py` with a corrected `--label`. |
| `refusing unsafe ZIP path` | ZIP contains `..` or absolute paths. | Re-export from Pixeel. Never hand-edit ZIP paths. |
| `esphome: command not found` | ESPHome not installed or not on PATH. | The script prefers `shutil.which("esphome")`, else falls back to `python -m esphome`. Install via `requirements-validation.txt`. |
| Web configurator shows stale font | `web-configurator/src/glyphs.generated.ts` out of date. | Run `python web-configurator/scripts/generate_glyphs.py` (maintainer path does this). |
