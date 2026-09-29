# Planned work

## Phase 16: Renderer and configurator

### Task 1: Repair digit slide-up animation

- [x] Reproduce the faulty digit transition in `tests/test_renderer.cpp` — `test_slide_animation_uses_ink_height_not_canvas_height()` reproduces the bug.
- [x] Correct clipping, timing, and changed-digit selection in the renderer — Fixed `draw_line` to use `font.ink_height()` instead of `c.height()` for slide distance.
- [x] Verify second, minute, hour, and rollover transitions — Covered by existing tests (`test_only_changed_digits_animate`, `test_animation_survives_hour_rollover`, `test_millis_wrap_keeps_clock_stable`).

### Task 2: Join matrix modules in the configurator preview

- [x] Remove visual gaps between adjacent 8×8 modules in the matrix canvas — `moduleGeometry()` joins boards edge to edge (`gap = 0`), so the canvas is exactly `modulesX × mod` wide and each board starts where the previous one ends.
- [x] Retain optional module-boundary guidance without shifting pixels — the *Module boundary guides* switch draws dashed lines into the shared bezel after the LEDs; the overlay is read-only and a single-module panel is a complete no-op.
- [x] Add boundary-focused configurator tests — `src/MatrixCanvas.test.ts` asserts seam geometry across 1×1…16×4 panels at four canvas widths, guide placement, dpr scaling and preview-only YAML isolation (60 Vitest checks, up from 45).

### Task 3: Compact the configurator

- [ ] Group controls into compact collapsible sections without hiding required settings.
- [ ] Keep keyboard access, labels, and small-screen layout usable.
- [ ] Verify YAML generation and share links remain compatible.

### Checkpoint: UI and renderer

- [x] Renderer and configurator test suites pass — `make -C tests test` reports 245 checks / 0 failures and `npm test` reports 60 passed in `web-configurator/`.
- [ ] Visual hardware check confirms animation and seamless module preview — still open: it needs a physical panel and a downloaded firmware build.

## Phase 17: Firmware identity and resilient time

### Task 4: Show firmware version at boot

- [ ] Add a short boot screen with the project firmware version.
- [ ] Return to the selected screen without delaying networking or OTA.
- [ ] Add renderer and configuration tests.

### Task 5: Add configurable SNTP fallback servers

- [ ] Keep Home Assistant time as the primary source.
- [ ] Expose bounded server substitutions with safe defaults, including a Google NTP endpoint.
- [ ] Test fallback selection when Home Assistant time is unavailable.

## Phase 18: Release awareness and latest channel

### Task 6: Define a signed-off release manifest

- [ ] Add a small, versioned manifest generated only for published releases.
- [ ] Define compatibility, URL, timeout, and failure behaviour.
- [ ] Add parser and downgrade-protection tests.

### Task 7: Add opt-in update checks

- [ ] Check the manifest at a bounded interval and expose installed/latest/update-available diagnostics.
- [ ] Never download firmware, change configuration, or expose secrets automatically.
- [ ] Verify offline, malformed-response, and GitHub-unavailable behaviour.

### Task 8: Make the configurator default to the latest published release

- [ ] Resolve “latest” to the newest immutable release tag at configuration-generation time.
- [ ] Keep an explicit advanced option to choose another supported tag.
- [ ] Update the generated YAML, documentation, and release-path tests.

### Checkpoint: Release safety

- [ ] `esphome config`, full ESP8266 compile, and all regression tests pass.
- [ ] Firmware-size delta is recorded and retains safe ESP8266 headroom.
- [ ] README documents update behaviour, privacy, and the latest-release policy.
