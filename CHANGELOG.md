# Changelog

## 0.7.22 - 2026-10-08

### Added

- Add an optional project-generated Georgian Mkhedruli bitmap font with all 33
  letters and clock glyphs. Render Georgian UTF-8 code points as single glyphs,
  use Georgian weekday/month names, and marquee long Georgian dates.

## 0.7.21 - 2026-10-08

### Fixed

- Expand every MG Minecraft Georgian date glyph to the same full eight-row
  height and correct the final month-letter code mapping.

## 0.7.20 - 2026-10-08

### Changed

- Use the bundled MG Minecraft Georgian 8 px pixel font for Georgian date
  labels and offer it as an optional Clock font.

## 0.7.19 - 2026-10-08

### Changed

- Render Georgian weekday and month labels using a bold 8 px Noto Sans Georgian
  raster in nine-pixel cells. Long labels continue to scroll instead of shrinking.

## 0.7.18 - 2026-10-08

### Changed

- Render Georgian weekday and month labels with wider cells and a bolder
  eight-row centre stroke. Long labels continue to scroll instead of shrinking.

## 0.7.17 - 2026-10-07

### Added
- Add a restored Screen transition animation selector: retain the horizontal
  Slide left transition or choose Slide up, matching the clock digits' motion.

## 0.7.16 - 2026-10-07

### Added
- Add a restored Date language selector with English and Georgian compact
  weekday and month abbreviations for every weekday date format.

## 0.7.15 - 2026-10-07

### Fixed
- Animate Time-to-Date and Date-to-Time transitions on 12-module displays.

## 0.7.14 - 2026-10-04

### Fixed
- Use a compact, high-contrast sun icon for clear weather on 8×8 panels.

## 0.7.13 - 2026-10-03

### Changed
- Add a compact degree ring after every whole-number side-panel temperature.

## 0.7.12 - 2026-10-03

### Changed
- Round both side-panel temperatures to whole numbers; no decimal values are
  shown on the 12-module clock or Date screen weather panel.

## 0.7.11 - 2026-10-03

### Fixed
- Publish the current 8×8 weather-icon and compact side-temperature fixes
  under a new version after `0.7.10` was already released.

## 0.7.10 - 2026-10-03

### Fixed
- Draw clear, distinct 8×8 icons for every supported weather condition and
  use the same compact temperature digits on both side panels; whole values no
  longer show a trailing `.0`.

## 0.7.9 - 2026-10-03

### Added
- Restored **Clock layout** selection for the 12-module display: clock only,
  indoor temperature + clock + weather icon, or indoor temperature + clock +
  weather icon and outdoor temperature. The preview includes sample values and
  icons without querying Home Assistant or adding installer credentials.
- Independent restored Date-screen switches for the weather icon and outdoor
  temperature. Either or both reserve the right three-module panel while date
  text remains clipped and scrollable in its safe area.
- Install-time Home Assistant entity sources for indoor temperature, dedicated
  outdoor temperature and a `weather.*` entity. The weather state selects the
  icon, its temperature attribute is a fallback, and a valid dedicated outdoor
  sensor takes priority. Unavailable or malformed readings use a safe
  placeholder.
- Compact clear/day and clear/night, partly cloudy, cloudy, fog, rain, snow,
  thunderstorm, windy and unknown weather icons, including common OpenWeatherMap
  state names. The legacy Temperature screen entity remains compatible.

### Changed
- The renderer confines the clock, date scrolling and digit animation to their
  panel regions; the legacy six-module clock layout retains its original
  full-width behavior.
- The installer validates Home Assistant entity-ID syntax and gives examples;
  its static configurator does not claim to browse a live entity registry.

## 0.7.8 - 2026-10-02

### Added
- Compact, aligned configurator cards with complete firmware bindings, expandable
  explanations, safe network options and an optional authenticated web server.
- Per-entity Home Assistant exposure using compile-time `internal` substitutions.
  Hidden entities keep their firmware IDs, defaults and actions; diagnostics and
  recovery controls remain exposed by default.

### Changed
- Automatic timezone follows the browser on load and tab return, including saved
  and shared profiles. Disable Automatic timezone to keep an explicit manual zone.
- Installer, preview and saved/shared settings use one validated model for both
  ESP8266 and ESP-WROOM-32, without accepting or storing credentials.

## 0.7.7 - 2026-10-02

### Fixed
- Selecting **180°** rotation in the configurator now also reverses the
  MAX7219 chip chain, so digits move to the correct module positions instead
  of only rotating within each 8×8 module.

## 0.7.6 - 2026-10-02

### Added
- The configurator now starts with a **hardware target** selector. Keep the
  **ESP8266 Wemos D1 mini** defaults, or switch to the **ESP-WROOM-32 DevKit**:
  the ESP32 installer uses `packages/base-esp32.yaml`, board `esp32dev`, CLK
  `GPIO18`, DIN `GPIO23`, CS `GPIO5` and OTA port `3232`. Board and pin choices
  follow the target, so ESP8266 aliases such as `D8` can never appear in an
  ESP32 installer. The ESP8266 configuration is unchanged.

## 0.7.5 - 2026-10-02

### Added
- **Weekday MMM.DD** is available as a compact date-format choice, for example
  `THU MAR.05`.

## 0.7.4 - 2026-10-02

### Added
- Date format choices now include **DD.MM.YY**, **Weekday DD.MM.YY**, and
  **Weekday DD. MMM YY**. The longer weekday formats scroll across a 48×8
  matrix instead of being cut off.
- A **Temperature** screen can show a Home Assistant numeric sensor. Choose
  its entity in the configurator's new **Temperature sensor entity** field.

## 0.7.3 - 2026-10-02

### Added
- **Date screen duration** is a Home Assistant setting (5–300 seconds). When
  automatic screen cycling is enabled, it controls how long Date remains
  visible independently of the Clock screen interval.

### Changed
- Switching between Clock, Date, Module grid test and Pixel checkerboard now
  uses the configured animation duration for a short horizontal slide. Boot,
  OTA, alerts and messages still appear immediately.

### Fixed
- Matrix 2px digit **0** now has its missing two-pixel top stroke.

## 0.7.2 - 2026-10-02

### Added
- **The web configurator pre-fills the timezone from the visitor's browser** on
  a first visit. The IANA zone from
  `Intl.DateTimeFormat().resolvedOptions().timeZone` is validated with the same
  rules as a hand-typed zone, flows unchanged into the generated installer YAML
  (`timezone: <zone>`) and the live preview, and can be re-applied at any time
  with the new **"Use my timezone"** button, which shows the detected value. A
  saved configuration or a shared link always keeps its own timezone, an
  unusable detection keeps the firmware default (`Europe/Berlin`), and nothing
  is geolocated, looked up or sent anywhere.

### Changed
- **Releases always bump the patch version.** A release-worthy change updates
  `project_ref` in `packages/base.yaml` and adds its `CHANGELOG.md` section, so a
  version is published as a plain `X.Y.Z` tag that is never moved or reused for
  another commit. The `X.Y.Z+<12-hex-sha>` tag scheme is gone: if a version was
  already published from a different commit, publication fails before anything
  is created and the fix is the next patch bump.

## 0.7.1 - 2026-10-02

### Fixed
- **Web configurator showed "Release lookup failed (403)"** - GitHub allows
  anonymous REST calls only 60 times per hour **per IP address**, shared by
  everyone behind the same router/VPN. The page re-verified the newest release
  on every tab switch and every reload with no reuse, so the quota ran out and
  GitHub answered 403. The configurator now reads GitHub's rate-limit headers
  and shows a timed pause ("Automatic retry at HH:MM") instead of an opaque
  failure, retries by itself when the window reopens, re-checks in the
  background every 15 minutes instead of 5, reuses a verification younger than
  5 minutes on tab focus and reload (per tab, per exact bundle) and lets
  consecutive copy/download clicks share one pre-export check. Installer
  export still fails closed: a paused or unverified release never enables it.
- The release status reads "not verified" rather than "checking…" next to an
  error, so a stalled check is no longer mistaken for one in progress.

### Changed
- Version **0.7.1** supersedes the hand-made `0.7.0` GitHub release, which
  points at a commit whose validation failed, has no installer asset and whose
  notes differ from the firmware contract, so the configurator could never
  verify it. Releases must be published by the main-push workflow
  (`scripts/publish_release.py`), not drafted in the GitHub UI.

## 0.7.0 - Unreleased

### Added
- Installed immutable firmware version on the matrix for 2.5 seconds at boot,
  without delaying networking, followed by the restored screen/power state.
- A generated firmware contract for all configurator controls, defaults,
  Home Assistant entities/actions, package files, fonts and release notes.
  Stale generated data and pixel/YAML parity now fail automated checks.
- An anonymous, fail-closed resolver for the newest published immutable release,
  with tagged-contract, commit and release-note verification before installer
  copy/download. Existing releases without the contract cannot yet be installed
  through this candidate UI.
- Preparatory installer/validation/release scripts. Automatic main-push release
  publication and matching Pages deployment are **not wired or validated yet**;
  they remain follow-up work in ROADMAP.md.

### Changed
- Target ESPHome **2026.9.1 exactly** in firmware and validation tooling; CI
  migration remains open.
- Default builds compile exactly **Pixel Clock 6×8 and Matrix 2px**. All other
  compatible fonts are opt-in with no selection cap; Compact 5×7 stays built in.
- Configure contains only adjustable settings and the live preview. Hardware,
  installation, font details, entity reference and release notes are in Info & Help.

### Fixed
- Sample digit slides at 20 ms, clip each changed digit to its own ink window,
  cancel when disabled or layout/font changes, and reset history after overlays.
  Unchanged digits and separators remain stationary; duration and row gap stay
  Home Assistant controls.
- Restore the upper-left **two-pixel** stroke of Matrix 2px zero. The remaining
  design, advance and intended two-pixel style are unchanged.
- OTA callbacks consume ESPHome's **0–100 percentage** directly and synchronously
  flush the MAX7219 buffer while the normal loop is blocked. Readable start,
  percentage plus bar, completion and error/code screens override shutdown,
  inversion and zero/night brightness. Success holds 100% for one second after
  transfer; errors restore current preferences after eight seconds. Native OTA
  remains encrypted with the existing API key; web upload stays disabled.

### Previous unpublished fixes retained

### Fixed
- **Alarm mode never flashed** - brightness was only recomputed once per
  second, so the 500 ms alarm toggle was sampled at a cadence where its parity
  never changes and the panel froze at one level (dark or lit, depending on
  boot alignment). Brightness is now evaluated on every display refresh and the
  panel flashes twice per second as documented. Covered by the new renderer
  test `test_alarm_mode_flashes_twice_per_second`.
- **The web configurator pinned installer YAML to `main`** instead of the
  published release tag; it previously pinned `0.5.5`, matching `examples/release.yaml`,
  `packages/base.yaml` and the font packages. A new `src/yaml.test.ts` catalogue
  guard keeps the generated installer and the release example in sync (tag,
  package list, `!secret`-only credentials).
- **Restored the MD MAX72XX System face** - the font (regenerated
  byte-identically by `scripts/generate_md_max72xx_system_font.py`), its
  LGPL-2.1-or-later notice, the `packages/fonts/md-max72xx-system.yaml` release
  package, the firmware wiring and the Font Lab entry were missing even though
  the README and `packages/fonts/README.md` documented them. The MD Parola face
  also links its LGPL notice to `md-max72xx-system/LICENSE.txt`, which exists
  again.
- **Restored the Noto Sans/Serif Georgian source candidates** in `fonts/`
  (with their OFL licenses); `tests/test_config.py` and `fonts/README.md`
  expect them as future shortlist candidates.
- **The configurator's Font Lab checkboxes now drive the generated installer** -
  Pixel Clock 6×8 ships in every build and cannot be removed (main's default
  policy), while each ticked extra face (then Matrix 2px, Dot Matrix, MD Parola
  Numeric 7-Segment, MD MAX72XX System) adds exactly one font package; before,
  every face was forced into every build and the extra limit was ignored.
- **The preview's night window matches the firmware again** - equal
  start/end hours are an all-day night window (`housekeeping()`), not "never
  dim".
- Updated the font contract tests for the five-face catalogue and corrected
  stale documentation that still described unbundled faces (Jersey 15, Teko,
  Rajdhani Bold, Kdam Thmor Pro, Rationale, Handjet, Oxanium, Share Tech Mono)
  and the retired 33-face catalogue.

## 0.5.5 - 2026-10-01

### Added
- Show all bundled font sources in the web Font Lab; unmeasured faces remain preview-only.
- Add previous/next controls beside the live-preview face name.

### Changed
- Split the configurator into focused Configure and Info & help pages.
- Make ESPHome firmware compilation an opt-in build-server check.

## 0.5.4 - 2026-10-01

- Correct the animation separation control: **Animation row gap** (0–2 rows,
  default 1) now adds blank vertical LED rows between the outgoing digit and
  the incoming digit. It no longer changes horizontal digit spacing.

## 0.5.3 - 2026-10-01

- Add an animation-separation control. Superseded by 0.5.4's vertical
  **Animation row gap** implementation.

## 0.5.2 - 2026-10-01

- Add **Pixel Clock 6×8**, an optional MAX7219 matrix-clock face with rounded
  six-column digits and two-column edges. It is selectable in Font Lab and the
  Home Assistant Clock font control, fits `HH:MM:SS` exactly on a 48×8 panel,
  and uses the existing per-digit slide-up animation.

## 0.5.1 - 2026-09-30

- Add **MD Parola Numeric 7-Segment**, an optional 8×8 MAX7219 matrix clock
  face converted from the `numeric7Seg` bitmap used by the upstream
  `Parola_Zone_TimeMsg` example. It is available in Font Lab and supports the
  existing per-digit slide-up animation. The source conversion, limited clock
  glyph set, and LGPL-2.1-or-later notice are retained in the repository.

## 0.5.0 - 2026-09-30

- Rework the configurator layout around the live matrix: the preview column now
  holds only the device (48x8 panel, current time, selected face and fit), so
  the first desktop screen shows the whole matrix with no empty gap above it,
  and the preview controls (frozen time, message composer, digit-slide readout,
  fact strip) head the settings column beside it. Tighter topbar/shell padding,
  matrix-first markup on phones as well.
- Fix the pinned matrix on phones: it is positioned at the *measured* bottom
  edge of the section nav (`--pin-top`, written by `usePinnedChrome`) instead of
  a hard-coded offset, so the menu no longer overlaps the panel at the top of
  the page and the panel no longer covers the header buttons. Explicit stacking
  (opaque nav at 50, chassis at 40), safe-area-aware centring with a 640 px cap,
  a measured `--chassis-h` for anchor jumps, and a `ResizeObserver`-guarded
  canvas measurement.
- Paint the panel as one board: a single shell and a single dark face under one
  continuous dot lattice, so no bezel is drawn at the former 8x8 seams, and cap
  the dot pitch by the available width so the panel is never wider than its
  container (no horizontal overflow at 320 px).
- Add the firmware's per-digit slide-up animation to the preview
  (`src/digitAnimation.ts`): only digits whose value changed move, the old digit
  leaves upwards and the new one arrives from below, colons and unchanged digits
  stay still, `offset = floor(progress * ink_height)` runs over the *Animation
  duration* slider (600 ms default, 0 off) behind the *Digit slide-up animation*
  switch, and `prefers-reduced-motion` disables it. Repaints are rAF-driven and
  only fire when the whole-row offset changes; *Replay last change* demonstrates
  one slide on a frozen preview time. LED dots are blitted from cached sprites.
- Renderer fidelity: the blinking colon keeps its advance and only loses ink, so
  the line no longer re-centres between odd and even seconds, and `draw_line()`'s
  clamp of a negative start to 0 is mirrored.
- Copy and controls: accurate Font Lab counts in Tune, readable preview-layout
  option labels, an animation-duration hint, corrected "above"/"below" wording.
- Onboard the MD MAX72XX System face added to the firmware: a Font Lab entry
  (size 8, LGPL-2.1-or-later) and regenerated preview glyphs, so selecting it
  includes `packages/fonts/md-max72xx-system.yaml` in the installer and the
  catalogue sync guard (`yaml.test.ts`) stays green.
- Tests: 94 -> 134. New `src/digitAnimation.test.ts` (slide timing, drawn
  frames, switch/duration/reduced-motion), a jsdom mount in
  `src/app.dom.test.tsx` (measured pin offsets, matrix-first markup, slide
  replay and settle through the UI, font checkbox -> preview -> installer YAML,
  gallery and no-credential checks), extended panel/seam geometry, and a parsed
  CSS layout contract in `src/app.test.tsx`.

- Redesign the web configurator into a complete, mobile-first project website:
  one scrolling document (Live preview, Tune, Font Lab, Hardware and Wiring,
  Install YAML, Home Assistant, Troubleshooting, Gallery, Docs) with a sticky
  anchor nav, replacing the five-tab deck. Dark workshop restyle with amber/red
  LED accents, hazard-stripe section rules, small radii and stronger contrast.
- Pin the matrix preview on phones: the chassis is fixed under the nav (with a
  ResizeObserver-sized spacer) so the live panel stays visible over every
  section; from 980 px it becomes a sticky rail. Add a labelled status strip
  (selected face, panel pixel size, HH:MM:SS fit, fallback state) and a clear
  width warning whenever the selected font exceeds the panel.
- Move font selection into a dedicated Font Lab that visibly separates
  "Fonts included in firmware" from the preview-only candidates, states that
  candidates are never compiled or exported, and keeps the checkbox-selects-
  preview behaviour. Replace the self-hosting tab with a documentation section
  linking README, VALIDATION, ROADMAP and Issues; deployment notes stay in
  `web-configurator/README.md`. Design contract recorded in
  `web-configurator/REDESIGN.md`.
- Add a six-photo hardware gallery (running clock, back-side wiring, controller
  end view, D1 Mini, module macro, workbench) with full alt text and captions,
  a wiring table, and troubleshooting entries for blank display, mirrored
  modules, wrong time, wide fonts and encrypted native OTA.
- Tests: seamless-lattice assertions (zero gap/inset, cross-seam pitch, exact
  canvas size), gallery/section/nav coverage, pinned-mobile CSS coverage,
  width-warning wording, and preview-only font exclusion from generated YAML
  (94 tests total; renderer, YAML-safety and font-inclusion suites unchanged).

## 0.4.0 - 2026-09-30

- Add compile-time font inclusion for 0.4.0: Matrix 2px and Dot Matrix are
  defaults (with Dot Matrix as the initial active clock face); users can add up
  to three external faces in Tune. Compact 5×7 stays always available. Persist
  and validate inclusion arrays in saved settings and share links.
- Split release fonts into per-face packages (`packages/fonts/*.yaml`) with
  matching `!extend clock_font` option extensions, `-DMAX7219_FONT_*` compiler
  flags, and guarded display wiring. Keep full local measurement catalogue and
  licenses (`packages/fonts_local.yaml`). Reset uses the always-present Compact
  face. Document saved numeric-index restoration semantics (`restore_value: true`)
  across subset changes.
- Validate exact ESPHome 2026.9.1 (Python 3.12.7) config and full ESP8266
  firmware builds for the default two-face configuration (`505,141 / 1,044,464 B`
  flash `48.4%`, `41,276 / 81,920 B` RAM `50.4%`, saving `5,448 B` flash and
  `4,688 B` RAM vs all 10 faces), built-in-only (`0` faces), single-face
  (`Matrix 2px`, `Dot Matrix`), max configurator subset (`5` faces), and offline
  release path (`scripts/validate-release-offline.sh 0.4.0`).
- Publish immutable release tag `0.4.0`, verify remote configuration fetch from
  GitHub (`ref: "0.4.0"`), remove draft `0.4.0` warnings, and enable installer
  copy/download (`INSTALLER_READY = true`) in the web configurator.


- Group Tune controls in native collapsible sections; keep Clock face, Hardware
  and Device expanded initially, preserve settings when collapsed, and add
  disclosure markup regression coverage. Correct stale configurator font counts.

- Join the 8×8 modules in the configurator preview: the 8 px gap between the
  boards is gone, so a six-module panel is painted edge to edge like a soldered
  chain. A new *Module boundary guides* switch draws dashed seam markers as an
  overlay - single-module panels stay untouched and no pixel ever moves.
- Add boundary regression coverage to the configurator: the module seam,
  the guide placement inside the shared bezel, the device-pixel-ratio scaling
  of the dashes and the preview-only keys are asserted directly.

- Add the generated **Matrix 2px** clock face: digits fill all eight matrix
  rows and every number stroke is exactly two pixels thick. The TrueType file
  is produced by `scripts/generate_matrix_font.py` and is asserted
  pixel-for-pixel against its design in `tests/test_config.py`.
- Fix the blinking colon re-centring the clock every second on Rajdhani Bold
  and Rationale, where `:` and space have different advances: the separator
  now keeps its advance and only its ink disappears.
- Fix Latin messages and the `OTA`/`ERROR` screens when an external face is
  selected: texts the selected font cannot render now fall back to the
  built-in font (as the documentation promises) instead of collapsing
  zero-advance glyphs, and message centring uses the metrics of the font that
  actually draws.
- Fix "Restore display defaults" setting the clock font to the non-existent
  option `Silkscreen Bold`; it now restores `Jersey 15`.
- Add the missing `+` glyph to the built-in font and stop float comparison
  noise from republishing the brightness entities every second.
- Fix the configurator type-check (a removed font id was still referenced by
  the fallback tests).

## 0.3.0 - 2026-09-29

- Make five large, exact-eight-row faces the default firmware font set: Jersey
  15, Teko, Rajdhani Bold, Kdam Thmor Pro and Rationale.
- Keep the broader licensed font catalogue in the repository without compiling
  all faces into every ESP8266 build.
- Correct the configurator's inverted LED preview and prevent glow halos from
  merging adjacent pixels.
- Add automated coverage for per-LED inversion, glow bounds, exact font height,
  clock width and firmware/configurator font parity.

## 0.2.0 - 2026-09-29

- Add 28 OFL clock-font choices, bringing the repository catalogue to 33 faces.
- Add Noto Sans Georgian and Noto Serif Georgian at 8 px with complete modern
  Mkhedruli and Mtavruli glyph sets.
- Add real-glyph previews for every face to the web configurator.
- Keep the complete catalogue within ESP8266 limits by compiling numeric/status
  glyphs in external faces and using the compact built-in font for Latin text.
- Validate the full build with ESPHome 2026.9.1: 50.7% flash and 77.1% RAM.

## 0.1.2 - 2026-09-28

- Add the Silkscreen Bold default face and publish the initial configurator.
