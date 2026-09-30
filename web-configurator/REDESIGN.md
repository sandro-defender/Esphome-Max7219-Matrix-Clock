# Web Configurator — Redesign Plan

This document is the design contract for turning the tabbed configurator into a
polished, complete, mobile-first project website. It records the visual and
content decisions, the responsive CSS strategy, the accessibility checklist and
the test matrix that guards the key interactions.

Scope is presentation and content only: the generated-YAML contract, the
firmware-faithful renderer (`render.ts`), the font engine (`fonts.ts`,
`glyphs.generated.ts`), the seam-free canvas (`MatrixCanvas.tsx`) and the font
inclusion rules (`fontSelection.ts`) keep their behaviour. Their tests keep
passing unchanged.

---

## 1. Visual redesign

Dark workshop/electronics style, warm amber and blood-red LED accents. The
reference is the physical device: black PCB, dark bench mat, glowing dot LEDs.

| Token | Value | Use |
|---|---|---|
| `--bg` | `#100e0c` | page background |
| `--bg-2` | `#191611` | raised surfaces |
| `--ink` | `#f6f0e6` | primary text (contrast ≥ 14:1) |
| `--muted` | `#c4b5a2` | secondary text (≥ 8:1) |
| `--amber` | `#ff9f1a` | primary accent, active states, focus ring |
| `--amber-2` | `#ffd18a` | accent text on dark |
| `--blood` | `#ff0838` | LED red, warning highlights |
| `--danger` | `#ff8b66` | warning text (≥ 7:1) |
| `--line` | warm 12 % alpha | hairline borders |

Rules:

* No decorative colour gradients. The only gradients are the LED dot rendering
  (a physical simulation, not decoration) and the subtle ambient wash behind
  the chassis. Section headers use a 3 px hazard-stripe rule
  (`repeating-linear-gradient`) — a workshop pattern, not a fade.
* Radii stay small and mechanical: 4–8 px controls, 12 px panels, 16 px
  chassis. No oversized rounded cards.
* Type: Fraunces (display), Outfit (body), IBM Plex Mono (labels, code,
  readouts) — unchanged, already self-hosted via Google Fonts with `display=swap`.
* Every pixel of the live panel keeps its seam-free treatment: modules join
  edge to edge (`gap === 0`, `inset === 0`), asserted by tests.

## 2. Section structure and copy

The five-tab deck becomes one scrolling document with a sticky anchor nav.
Order follows the way a builder actually works:

1. **Live preview** (`#preview`) — hero line, the seam-free 48×8 chassis with
   the matrix, status readout (selected face, panel pixel size, HH:MM:SS width
   vs panel, fallback state), preview-time freeze, Home-Assistant message
   composer, live fact strip. Pinned on mobile (see §3).
2. **Tune** (`#tune`) — native `<details>` groups: Clock face (preview layout,
   module-boundary guides, face facts, link into Font Lab), Screen, Messages,
   Light, Hardware, Device. Clock face, Hardware and Device start open.
3. **Font Lab** (`#font-lab`) — two visibly separated groups:
   * **Fonts included in firmware** — Matrix 2px and Dot Matrix fixed defaults,
     up to three optional faces via labelled checkboxes. Checking a face adds
     the package and *immediately selects it in the live preview*; unchecking
     the active face returns to Dot Matrix. Cards show the rasterised glyphs,
     compiled size, measured HH:MM:SS width and per-panel warnings.
   * **Preview-only Font Lab** — bundled candidate faces (Georgian families,
     Audiowide, Bitcount…) labelled *preview only*, with licence notes and an
     explicit "never compiled, never in your installer YAML" statement.
   * A clear warning banner when the selected face is wider than the current
     panel: what the firmware will do (drop seconds → HH:MM + bar → built-in
     5×7 fallback).
4. **Hardware & Wiring** (`#hardware`) — default hardware table (D1 Mini,
   six modules, 48×8, CLK D8 / DIN D6 / CS D7, 5 V common ground), chain
   direction, level-shifter advice, boot-pin notes, power notes, and the
   firmware's two test patterns (module grid, pixel checkerboard).
5. **Install YAML** (`#install`) — the generated one-file installer with
   copy/download, the five install steps (place beside `secrets.yaml`,
   six `!secret` keys, `esphome config`, USB first, encrypted OTA after),
   the current substitution values with pointers to the control that changes
   each, a note that ESPHome downloads the version-pinned packages and fonts
   from GitHub at tag `0.4.0`, links to README / VALIDATION / ROADMAP /
   Issues, and the rename warning.
6. **Home Assistant** (`#assistant`) — entity map derived from the device name
   (selects, numbers, switches, buttons, diagnostics) and the API actions with
   copyable examples (`show_message`, `clear_message`, `start_countdown`,
   `cancel_countdown`, `show_status`, `get_status`) plus two ready automations.
7. **Troubleshooting** (`#troubleshooting`) — `<details>` entries: blank
   display, mirrored/swapped modules, wrong time, font too wide, OTA advice
   (encrypted native OTA, no plaintext web upload), plus release-ref, missing
   module and flash-space entries from the README.
8. **Gallery** (`#gallery`) — all six hardware photos with meaningful alt text
   and one-line captions: running clock, back-side wiring, controller
   end-view, D1 Mini, module macro, workbench.
9. **GitHub & documentation** (`#docs`) — README, VALIDATION, ROADMAP, Issues,
   live configurator, packages/font docs, ESPHome 2026.9.0 references, and a
   short note on how Pages deploys this app.

The old "GitHub" self-hosting tab (workflow YAML, git commands, standalone
export) moves to `web-configurator/README.md`, which already documents the
deploy workflow; the site links there instead of carrying deployment tooling in
the user page.

Copy principles: short declarative sentences, firmware-truthful wording (the
preview "mirrors `max7219_clock_renderer.h`"), safety statements in the first
person plural ("we never ask for credentials"), no marketing fluff.

## 3. Responsive CSS strategy

Mobile-first, one stylesheet (`src/index.css`), design tokens in `:root`:

* **320 px+ (base)** — single column. Top bar stacks brand + action row; the
  section nav is a horizontally scrollable single-row strip (`overflow-x:
  auto`, visible focus). Sections stack with `scroll-margin-top` so anchor
  jumps land below the pinned chrome. Photo grids, font grids, `two`-column
  forms and entity tables collapse to one column; code blocks and tables get
  `overflow-x: auto` wrappers so nothing overflows the viewport.
* **Pinned preview (≤ 979 px)** — the matrix chassis becomes `position:
  fixed` directly under the nav (`top: calc(var(--nav-h) + 8px)`), with an
  in-flow `.chassis-slot` spacer sized from a `ResizeObserver` so no content
  jumps or hides. The readout, notices and controls scroll normally beneath
  it. This is the strongest possible interpretation of "keep the matrix
  preview pinned near the top while the user scrolls settings", and it works
  across every section because the chassis leaves the flow only visually.
* **≥ 980 px** — two-column shell: the preview column is a grid item spanning
  the full row height with `position: sticky` (`top: calc(var(--nav-h) +
  16px)`), so the matrix stays visible beside every section; Tune groups can
  sit open without pushing the matrix away.
* **≥ 720 px** — photo grid 2 columns, font grid 2 columns, `two` field pairs
  side by side; **≥ 1240 px** the shell is capped and centred.
* Motion: `@media (prefers-reduced-motion: reduce)` disables smooth scrolling
  and the brand dot animation.

## 4. Accessibility checklist

- [x] Landmarks: `header`, `nav[aria-label]`, `main`, `section[aria-labelledby]`, `footer`.
- [x] Skip link to the Tune controls.
- [x] One `h1`; sections use `h2`, groups `h3` in order.
- [x] All controls are native elements: `button`, `input`, `select`,
      `label`, `fieldset/legend`, `details/summary` — keyboard operable by default.
- [x] Toggles expose `aria-pressed`; segmented groups use `role="group"` +
      `aria-pressed`; the extra-font checkboxes are real checkboxes in a
      `fieldset` with a `legend`.
- [x] Visible focus: 2 px amber `:focus-visible` outline everywhere, including
      summaries and chips.
- [x] Canvas matrices carry `role="img"` + descriptive `aria-label`; glyph
      strips describe their font sample.
- [x] Gallery figures: meaningful `alt` + visible captions.
- [x] Colour contrast: body ≥ 14:1, muted ≥ 8:1, warning/danger ≥ 7:1, text on
      amber ≥ 8:1; never colour alone for warnings (icon word + text).
- [x] Status changes (`notice`, copy confirmations, font-counter) use
      `role="status"` / `aria-live="polite"`.
- [x] Target sizes ≥ 40 px for repeated controls (chips, checkboxes rows).
- [x] `prefers-reduced-motion` respected.
- [x] No `type="password"` anywhere — the page never asks for credentials.

## 5. Behaviour and safety invariants (unchanged)

* Generated YAML contains only local `!secret` credential references; no
  credential field exists in the UI, storage, links or repo.
* Preview-only fonts never appear in the generated YAML or as firmware
  options; preview-only aids (LED colour, layout illustration, boundary
  guides, frozen preview time) are labelled and never exported.
* Font inclusion: Matrix 2px + Dot Matrix defaults, ≤ 3 extras, canonical
  order, hostile-input sanitised, removal of the active extra falls back to
  Dot Matrix, checking an extra immediately selects it in the preview.
* The panel is painted as one continuous LED lattice (no module seams), with
  optional boundary guides that move no pixel.
* Fallback chain mirrors the firmware: full HH:MM:SS → HH:MM + seconds bar →
  built-in 5×7; the readout and Font Lab state which rung is active.

## 6. Test matrix

| Interaction / requirement | Test |
|---|---|
| Checking an optional font adds it **and selects it in the preview** | `fontSelection.test.tsx` (`addExtraFontAndSelect`) |
| Extra-font limits, order, hostile input, share-link round trip | `fontSelection.test.tsx` |
| Matrix is one seamless lattice: `gap === 0`, `inset === 0`, cross-seam dot pitch equals in-module pitch, canvas width `= cols × pitch × 8` | `MatrixCanvas.test.ts` ("seamless panel") |
| Boundary guides move no pixel | `MatrixCanvas.test.ts` (existing) |
| Mobile pinned preview: fixed-chassis rule exists at the pin breakpoint and the stage renders the spacer slot | `app.test.tsx` + `liveStage` markup assertions |
| Gallery: every photo file exists, every file is used, each `figure` has `alt` ≥ 40 chars + caption; doc links (README/VALIDATION/ROADMAP/issues) present | `app.test.tsx` |
| Sections + nav: all nine section ids, nav anchors, one `h1`, native `<details>` groups | `app.test.tsx` |
| Generated YAML never includes preview-only fonts or settings | `yaml.test.ts` + new assertions over `PREVIEW_CANDIDATES` ids |
| YAML safety, release sync, clamping, font options | `yaml.test.ts` (unchanged) |
| Firmware-faithful rendering, fallback chain, patterns | `render.test.ts` (unchanged) |
