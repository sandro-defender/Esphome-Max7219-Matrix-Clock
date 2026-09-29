# Planned work

## Phase 16: Renderer and configurator

### Task 1: Repair digit slide-up animation

- [ ] Reproduce the faulty digit transition in `tests/test_renderer.cpp`.
- [ ] Correct clipping, timing, and changed-digit selection in the renderer.
- [ ] Verify second, minute, hour, and rollover transitions.

### Task 2: Join matrix modules in the configurator preview

- [ ] Remove visual gaps between adjacent 8×8 modules in the matrix canvas.
- [ ] Retain optional module-boundary guidance without shifting pixels.
- [ ] Add boundary-focused configurator tests.

### Task 3: Compact the configurator

- [ ] Group controls into compact collapsible sections without hiding required settings.
- [ ] Keep keyboard access, labels, and small-screen layout usable.
- [ ] Verify YAML generation and share links remain compatible.

### Checkpoint: UI and renderer

- [ ] Renderer and configurator test suites pass.
- [ ] Visual hardware check confirms animation and seamless module preview.

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
