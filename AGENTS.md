# Agent instructions

ESPHome MAX7219 matrix clock for ESP8266 (Wemos D1 mini). The firmware is
modular (`packages/`), the web configurator is static (`web-configurator/`), and
`.github/workflows/validate-code.yml` validates every main push and PR, then
publishes a release and redeploys Pages from every successful main push.

Read this file first. It is the contract; the linked files hold the detail.
Only these paths are entry points: `dev.yaml` (local `!include` build) and the
generated `examples/release.yaml` (pinned install). There is no
`max7219-clock.yaml`; check every path with `ls` before you write it down.

## Before you change anything

- [ ] `git status`: keep unrelated changes; work on a branch, never push `main`.
- [ ] Decide the firmware target is still **ESPHome 2026.9.1 exactly**
      (`packages/base.yaml` `min_version`, `requirements-validation.txt`).
- [ ] Read [packages/README.md](packages/README.md) (module map) and
      [packages/fonts/README.md](packages/fonts/README.md) (font policy).
- [ ] Decide if the change is release-worthy. If yes, bump `project_ref` in
      `packages/base.yaml` **and** add the matching `CHANGELOG.md` section in the
      same PR. If it is docs-only, keep it to one PR.
- [ ] If you touch any path in the generator's `all_paths` (below), regenerate
      the contract in the same commit: `python scripts/generate_firmware_contract.py`,
      then `python web-configurator/scripts/generate_glyphs.py` if fonts changed.
- [ ] Run the code gate on Python 3.12–3.14 with
      `pip install -r requirements-validation.txt` and `npm --prefix web-configurator ci`,
      then `python scripts/check_code.py` ([VALIDATION.md](VALIDATION.md)).
- [ ] Keep every credential out of the repository: `!secret` in user YAML only,
      `secrets.yaml` untracked, generated installers reference `!secret` names.
- [ ] Label firmware compile, flash size and on-device behaviour **Unverified**
      unless a dated measurement exists in [VALIDATION.md](VALIDATION.md) or
      [docs/HISTORY.md](docs/HISTORY.md).

## Never do

- **Never create, edit, delete or re-publish a release or tag by hand, and never
  move an existing tag.** The browser verifies the newest published release
  against the firmware contract: exact notes (`## <tag>` plus the CHANGELOG
  section), the generated installer asset and tag → commit. A release built in
  the GitHub UI can never pass and silently breaks the public installer. Only
  the main-push workflow publishes ([RELEASING.md](RELEASING.md)).
- **Never delete workflow releases or tags "to clean up".** `X.Y.Z` is the first
  commit at a version; later commits at that version get `X.Y.Z+<12-hex-sha>`.
  These tags are the immutable publication scheme, not junk. Deleting them
  leaves the deployed site with no matching release.
- **Never assume a docs-only merge is harmless: every merge to `main` publishes
  a release and redeploys Pages.** Batch documentation into one PR.
- **Never hand-edit a generated file.** `web-configurator/src/firmware.generated.json`,
  `web-configurator/src/glyphs.generated.ts`, `packages/restore_defaults.generated.yaml`,
  `packages/local_fonts/*.yaml`, `packages/fonts_default_local.yaml`,
  `packages/fonts_local.yaml` and `examples/*.yaml` come from
  `scripts/generate_firmware_contract.py` and
  `web-configurator/scripts/generate_glyphs.py`.
- **Never rewrite a released `CHANGELOG.md` section.** Published sections are
  release notes and part of the firmware-contract hash; a new change gets a new
  section with a `project_ref` bump.
- Never ask for, print or commit Wi-Fi, API, OTA or web-server credentials.
- Never force-push, rewrite history, or commit build output (`build/`,
  `.esphome/`, `dist/`, `node_modules/`, `validation-tmp/`).
- Never claim CI verifies a firmware build: CI never compiles firmware, never
  flashes a device and never runs a browser.

## The hashed firmware contract

`scripts/generate_firmware_contract.py` hashes `all_paths`: `dev.yaml`,
`CHANGELOG.md`, `packages/configurator.json`, `requirements-validation.txt`, the
generator itself, `web-configurator/scripts/generate_glyphs.py`, the core
package YAML and headers, `packages/fonts/*.yaml`, `packages/fonts_web.yaml`,
the bundled font files and their source/generator files. Any change there
changes `sourceHash`; CI then fails with "Firmware/configurator drift" until the
generated contract is regenerated. Regeneration needs Python 3.12+ with
`esphome==2026.9.1` importable (SDK imports only, no compile).

`python scripts/check_code.py --skip-sdk-checks` is **reduced coverage**, not a
pass: it omits the exact-SDK dependency check and both generated-freshness
checks.

## Commands that must pass

```bash
pip install -r requirements-validation.txt          # esphome==2026.9.1, freetype-py, fonttools
npm --prefix web-configurator ci --ignore-scripts
python scripts/check_code.py                        # full gate (Python 3.12–3.14)
python scripts/check_code.py --skip-sdk-checks      # local fallback, reduced coverage
python scripts/generate_firmware_contract.py --check
python web-configurator/scripts/generate_glyphs.py --check
git diff --check
```

## Where to look

| Question | File |
| --- | --- |
| What the user sees, install steps, entities | [README.md](README.md) |
| How releases and Pages really work | [RELEASING.md](RELEASING.md) |
| Exact checks, versions, blind spots | [VALIDATION.md](VALIDATION.md) |
| What is still open, with acceptance criteria | [ROADMAP.md](ROADMAP.md) |
| Why past decisions were made | [docs/HISTORY.md](docs/HISTORY.md) |
| Firmware modules | [packages/README.md](packages/README.md) |
| Font policy, licences, add-a-font steps | [packages/fonts/README.md](packages/fonts/README.md) |
| Font assets and licences | [fonts/README.md](fonts/README.md) |
| Configurator internals, scripts, generated files | [web-configurator/README.md](web-configurator/README.md) |

One source of truth per fact: link instead of repeating. Keep claims in the
present tense and every command copy-pasteable.
