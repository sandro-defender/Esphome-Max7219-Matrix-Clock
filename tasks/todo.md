# Current checkpoint and next work

## 2026-10-02 — draft PR hand-off

The latest instruction is to finish this step, document the roadmap and push a
PR. Candidate `0.7.0` targets **ESPHome 2026.9.1 exactly** and remains unreleased.
The current acceptance checklist is [ROADMAP.md](../ROADMAP.md); historical
checked tasks below do not certify this candidate.

- [x] Checkpoint default Pixel Clock 6×8 + Matrix 2px, repaired zero, per-cell
  slides, boot/secure OTA, firmware-derived controls/help/YAML and tagged pixel
  parity. Extra compatible fonts are opt-in with no artificial cap.
- [x] Migrate stale Python contracts and run current C++/Python/web checks,
  typecheck/build, generated freshness and five exact-target YAML/codegen variants.
- [x] Separate historical compile/size results from current evidence.
- [x] Commit/push only `arena/01a0f913-esphome-max7219-matrix-clock` and open
  **[draft PR #13](https://github.com/sandro-defender/Esphome-Max7219-Matrix-Clock/pull/13)**. No main push, release/tag publication or Pages deployment.

## Next increment, not part of this checkpoint

1. Audit/test the publisher and migrate every-main/PR CI; wire immutable
   publication before same-commit Pages deployment. Legacy workflows remain.
2. Obtain full default/all-font ESP8266 builds and size/headroom evidence;
   current toolchain download fails with TLS EOF/HTTPClientError.
3. Extend stateful timeline parity and verify live immutable installer fetch.
4. Perform manual accessibility and physical font/animation/boot/encrypted-OTA
   checks, then record exact release/commit/deployment and request merge sign-off.

## Archived tasks from base commit e693db4

Original task states, ESPHome 2026.9.0 evidence and old font/default policies are
preserved below for traceability only. Earlier SNTP/device update-check plans
remain prior backlog, not newly implemented features in this checkpoint.

## Planned work

### Phase 16: Renderer and configurator

#### Task 1: Repair digit slide-up animation

- [x] Reproduce the faulty digit transition in `tests/test_renderer.cpp` — `test_slide_animation_uses_ink_height_not_canvas_height()` reproduces the bug.
- [x] Correct clipping, timing, and changed-digit selection in the renderer — Fixed `draw_line` to use `font.ink_height()` instead of `c.height()` for slide distance.
- [x] Verify second, minute, hour, and rollover transitions — Covered by existing tests (`test_only_changed_digits_animate`, `test_animation_survives_hour_rollover`, `test_millis_wrap_keeps_clock_stable`).

#### Task 2: Join matrix modules in the configurator preview

- [x] Remove visual gaps between adjacent 8×8 modules in the matrix canvas — `moduleGeometry()` joins boards edge to edge (`gap = 0`), so the canvas is exactly `modulesX × mod` wide and each board starts where the previous one ends.
- [x] Retain optional module-boundary guidance without shifting pixels — the *Module boundary guides* switch draws dashed lines into the shared bezel after the LEDs; the overlay is read-only and a single-module panel is a complete no-op.
- [x] Add boundary-focused configurator tests — `src/MatrixCanvas.test.ts` asserts seam geometry across 1×1…16×4 panels at four canvas widths, guide placement, dpr scaling and preview-only YAML isolation (60 Vitest checks, up from 45).

#### Task 3: Compact the configurator

- [x] Group controls into compact collapsible sections without hiding required settings — native details/summary; Clock face, Hardware and Device initially expanded; static-render regression test.
- [ ] Keep keyboard access, labels, and small-screen layout usable.
- [x] Verify YAML generation and share links remain compatible — existing YAML/storage tests pass unchanged (61 configurator tests total).

#### Checkpoint: UI and renderer

- [x] Renderer and configurator test suites pass — `make -C tests test` reports 245 checks / 0 failures and `npm test` reports 60 passed in `web-configurator/`.
- [ ] Visual hardware check confirms animation and seamless module preview — still open: it needs a physical panel and a downloaded firmware build.

### Phase 17: Firmware identity and resilient time

#### Task 4: Show firmware version at boot

- [ ] Add a short boot screen with the project firmware version.
- [ ] Return to the selected screen without delaying networking or OTA.
- [ ] Add renderer and configuration tests.

#### Task 5: Add configurable SNTP fallback servers

- [ ] Keep Home Assistant time as the primary source.
- [ ] Expose bounded server substitutions with safe defaults, including a Google NTP endpoint.
- [ ] Test fallback selection when Home Assistant time is unavailable.

### Phase 18: Release awareness and latest channel

#### Task 6: Define a signed-off release manifest

- [ ] Add a small, versioned manifest generated only for published releases.
- [ ] Define compatibility, URL, timeout, and failure behaviour.
- [ ] Add parser and downgrade-protection tests.

#### Task 7: Add opt-in update checks

- [ ] Check the manifest at a bounded interval and expose installed/latest/update-available diagnostics.
- [ ] Never download firmware, change configuration, or expose secrets automatically.
- [ ] Verify offline, malformed-response, and GitHub-unavailable behaviour.

#### Task 8: Make the configurator default to the latest published release

- [ ] Resolve “latest” to the newest immutable release tag at configuration-generation time.
- [ ] Keep an explicit advanced option to choose another supported tag.
- [ ] Update the generated YAML, documentation, and release-path tests.

#### Checkpoint: Release safety

- [ ] `esphome config`, full ESP8266 compile, and all regression tests pass.
- [ ] Firmware-size delta is recorded and retains safe ESP8266 headroom.
- [ ] README documents update behaviour, privacy, and the latest-release policy.

### Font-subset work — published in 0.4.0

Latest user decision: Matrix 2px and Dot Matrix are included by default; add
up to three extras. Compact 5×7 is always available.

- [x] Implement per-face packages and subset-safe display/select wiring — source contracts over 1024 subsets and host syntax checks; exact ESPHome validation remains below.
- [x] Add included-font state, sanitization, persistence and share-link tests — 10 focused tests; default pair + max three extras.
- [x] Add Tune inclusion checkboxes and enable release downloads after 0.4.0 publication — `INSTALLER_READY = true`, draft 0.4.0 warnings removed, gate tests updated.
- [x] Test built-in only, one face, all faces and hostile links — offline/source and stub C++ checks plus full ESPHome 2026.9.0 builds across 0, 1, 2, 5, and 10 external faces.
- [x] Validate exact ESPHome 2026.9.0 configurations and full firmware builds — validated on Python 3.12.7 + ESPHome 2026.9.0 (`esphome config`, `esphome compile`, `scripts/validate-release-offline.sh 0.4.0`, and live remote fetch of `https://github.com/sandro-defender/Esphome-Max7219-Matrix-Clock@0.4.0`).
- [x] Record default/one-face flash and RAM deltas — default pair (`Matrix 2px` + `Dot Matrix`): 505,141 B flash (48.4%, +3,552 B vs 0 faces), 41,276 B RAM (50.4%, +1,188 B vs 0 faces); single face (`Matrix 2px`): 504,085 B flash (+2,496 B), 40,676 B RAM (+588 B); single face (`Dot Matrix`): 504,101 B flash (+2,512 B), 40,676 B RAM (+588 B); recorded in `VALIDATION.md` and `packages/fonts/README.md`.

Baseline rerun: renderer 245 checks, Python 32 tests (no skips after installing
measurement dependencies), configurator 60 tests, typecheck/build and glyph
freshness pass. After the disclosure-only increment: 61 configurator tests,
typecheck/build pass (312.18 kB single HTML). Browser keyboard/small-screen
verification is still pending; firmware files and installer generation unchanged.

Research: official packages documentation specifies concatenation for non-ID
lists, replacement for scalar values (do not append lambda strings). Exact-tag
`esphome/components/template/select/template_select.cpp` at 2026.9.0 restores
an index: a valid old index selects the possibly different face now at that
index; an invalid index uses initial_option. Subset migration must document this
and keep every reachable option compiled.

Final validation run (Python 3.12.7 + ESPHome 2026.9.0): renderer 245 checks (0
failures); Python 34 tests (0 skips, including `test_exact_esphome_font_option_merge`
over all 1,024 subsets and the default two-face release order); 71 Vitest tests,
clean typecheck/build, glyph freshness verified; `scripts/validate-release-offline.sh 0.4.0`
and live remote fetch of `https://github.com/sandro-defender/Esphome-Max7219-Matrix-Clock@0.4.0`
passed. Tag and GitHub release `0.4.0` published at `7c85cc49ec9c01c08adc26be9b2905ed85b9bd96`,
`INSTALLER_READY` set to `true`, draft warnings removed, and gate tests updated.
Browser installation still blocked by sandbox network policy, so real browser
keyboard/mobile interaction checks and physical hardware verification remain open.
