# Agent instructions

This repository contains an ESPHome MAX7219 matrix-clock configuration for an
ESP8266/Wemos D1 Mini.

Before changing any project file:

- [ ] Read [README.md](README.md).
- [ ] Read the complete [ROADMAP.md](ROADMAP.md).
- [ ] Inspect `git status` and preserve all existing user changes.
- [ ] Treat `esphome_Max7219-Matrix-Clock/max7219-clock.yaml` as the primary
      configuration until the modular package migration is validated.
- [ ] Do not keep the finished implementation in one YAML file. Build focused
      modules under `packages/` and keep the user-facing YAML small.
- [ ] Use substitutions for device-specific names, hardware settings, feature
      flags, and locally supplied secret values.
- [ ] Make the public installation download version-pinned package YAML and
      font assets directly from this repository.
- [ ] Preserve every font's license, restrict compiled glyphs, and measure
      ESP8266 firmware size before adding another font.
- [ ] Target ESPHome **2026.9.1 exactly** unless the user explicitly changes
      the target.
- [ ] Verify ESPHome-specific decisions against official documentation.
- [ ] Never ask for or expose Wi-Fi credentials, API keys, SSH keys, OTA keys,
      or web passwords. Use `!secret` and keep `secrets.yaml` untracked.
- [ ] Follow the user's current **code-only** instruction: do not run ESPHome
      config/build/compile/code-generation commands or retry toolchain downloads.
      Run offline script/source tests, host renderer tests and web checks instead;
      leave full firmware and hardware verification explicitly unverified.
- [ ] After each finished step, update the roadmap, commit/push only the existing
      Arena branch and update draft PR #13 with that step's evidence. Do not push
      main, force-push, or publish releases/deployments during this code work.
- [ ] Do not force-push, discard unrelated changes, or commit generated build
      output.

The checkbox roadmap is the implementation contract. Work through it in order,
update its checkboxes only when evidence exists, and record any hardware-only
verification that remains.
