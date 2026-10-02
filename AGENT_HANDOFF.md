# Copy-paste continuation prompt

Continue the existing work on `sandro-defender/Esphome-Max7219-Matrix-Clock`.
Read `AGENTS.md`, the complete `README.md` and complete `ROADMAP.md` before changes; preserve existing work. This handoff was written on 2026-10-02 after the user asked to stop this agent and continue with a new one because of the context limit.

## Standing instructions

- Code-only work. **Do not run ESPHome or PlatformIO CLI, firmware config/codegen/compile/build, or retry firmware toolchains.** Host C++ regressions, Python tests, TypeScript/web tests and a production web bundle are allowed. Exact-SDK imports/generated-freshness checks are allowed on compatible Python, not firmware CLI.
- Continue on `arena/01a0f913-esphome-max7219-matrix-clock` and update the **existing OPEN draft PR #13** after each finished step: https://github.com/sandro-defender/Esphome-Max7219-Matrix-Clock/pull/13 . No main push, force push, new PR, live tag/release publication or Pages deployment. Respect the new Arena session's branch restrictions if they prevent reusing this branch; explain that conflict before trying to switch branches.
- Keep firmware modular under `packages/`. Exact target is **ESPHome 2026.9.1**, not an older pin. Candidate **0.7.1** is published only by the main-push workflow; the hand-made `0.7.0` GitHub release is not installable.
- No browser automation, credential requests, or reading/copying production `secrets.yaml`. Preserve secure OTA and local `!secret` handling.
- Use `git` for local Git/push and `gh` for GitHub. Authentication is already configured. `gh pr edit` previously failed due to deprecated Projects GraphQL; use REST PATCH `repos/sandro-defender/Esphome-Max7219-Matrix-Clock/pulls/13` and POST `.../issues/13/comments` instead.
- The user was frustrated with investigation-only turns. Read required context once, then implement a focused regression and real code; do not spend another entire turn reporting plans.

## Completed, pushed work (do not repeat)

Last **tested implementation commit**: `dd1037f372e73a659504fc72b935b30f291c7215` (`fix: bound installer release verification and reject malformed responses`). The newer handoff checkpoint only preserves this document and an unfinished experimental file; it is not a completed/tested implementation step.

1. `6e187d4`: publisher safety hardening, 40 mocked tests.
2. `2753a67`: code-only CI/runner, 15 workflow tests, esbuild pin; hosted success documented by `1b0bd71`.
3. `8418b49`: main-only checks -> immutable source/YAML release -> matching-SHA Pages wiring, 22 deployment/workflow tests; removed the old publishing/deployment workflows. Publication/deployment remain unexercised.
4. `dd1037f`: browser release resolver streamed 1 MiB UTF-8 cap/cancellation, independent fetch/body deadlines, strict response/repository/SDK/version identity validation, no older-release fallback, annotated-tag cycle/depth bounds. 13 new tests, 22 resolver tests total. PR body updated and comment **5945732129** posted. Do not repost that delivery.

Step 4's reduced local gate passed: **113 Python tests run / 112 passed / 1 SDK skip**, **315 host checks**, **116 web tests**, TypeScript, production web bundle, and diff checks. Existing snapshot pixel parity covers **1,044 frames**; these are not sequential retained-runtime tests.

Hosted code-only run **36965718848** at `dd1037f` succeeded: https://github.com/sandro-defender/Esphome-Max7219-Matrix-Clock/actions/runs/36965718848 . Jobs were queried during handoff: **Source and preview checks succeeded; publish, site-build and deployment jobs were skipped**. Earlier runs at `2753a67`, `1b0bd71` and `8418b49` also succeeded. Detailed hosted logs/test totals were not downloaded. Several existing docs/PR body still say step 4 hosted CI pending; correct that with the next finished step.

## Step 5: unfinished stateful preview parity

The previous agent promised to fix stateful preview/runtime parity without firmware builds. Investigation found:

- `web-configurator/src/render.ts::choosePage` uses stateless elapsed-slot arithmetic for automatic Clock/Date cycling. Firmware uses retained screen/timer state and one-second housekeeping, toggling only once after a delayed tick.
- `web-configurator/src/usePreview.ts` uses `Date.now()` for message/cycle/runtime despite its monotonic-source comment. It resets cycle origin when auto-cycle/screen/interval preferences change, unlike actual housekeeping.
- `tests/renderer_fixture.cpp` resets `Runtime` and produces snapshots. It cannot yet verify actual sequential state transitions or post-render report feedback.

**Only one new experimental source file exists:** `web-configurator/src/previewTimeline.ts`. It introduces uint32 millis/deadline helpers and a `PreviewTimeline` class for normal screens/message expiry/cycling. **It is NOT imported by `usePreview` or `renderScene`, has NO new tests, and has NOT been typechecked or validated.** No preview fix is delivered yet. Review/rework it against the actual C++ oracle; do not trust its comments as parity evidence. In particular, changes to message-hold preferences, screen-option mapping, and any handling of expired messages need verification against actual firmware actions/writer mappings.

No Step 5 changes were made to `render.ts`, `usePreview.ts`, `digitAnimation.ts`, `parity.test.ts`, `render.test.ts` or `renderer_fixture.cpp`. No tests were rerun for the handoff checkpoint.

### Actual firmware semantics to preserve

Use `packages/max7219_clock_renderer.h` and post-render handling in `packages/display.yaml` as the source of truth; use `tests/frame.generated.h` for actual writer preferences/clamps rather than duplicating mappings.

- Housekeeping runs when `last_tick_ms == 0` or unsigned elapsed time is >= 1000 ms; zero timestamps are stored as 1. Boot timeout is checked on every render.
- Temporary-screen visibility checks deadlines every render; expired message/alert queue state is cleared only on housekeeping ticks.
- Auto-cycle runs only on housekeeping, with no message/alert/countdown/OTA/boot and a normal screen. Minimum interval is 5 seconds; first eligible tick arms it; an overdue tick toggles **once**, not multiple elapsed slots.
- **Messages/temporary screens do NOT reset `cycle_last_ms`.** They block advancement while retaining it. Once eligible again, an overdue cycle may switch immediately. It resets only when auto-cycle is off (within housekeeping).
- Renderer draws the current `Frame.screen`; `Report.screen_changed` is applied by YAML **after drawing**, so the new screen appears on a subsequent frame.
- Marquee origin starts/restarts when visible message text hash changes at rendering, not simply because wall-clock time advances.
- Digit animation retains the original previous digits/start while a target changes in flight; unchanged digits and colons remain stationary. Layout/font/geometry/alignment changes, non-fixed pages/overlays, disabling animation or zero duration cancel it. Duration/row-gap controls remain firmware-derived.
- Countdown completion produces a 5-second DONE alert on housekeeping. Full countdown/alert/boot/OTA timelines are **not verified** by the proposed normal/message class; keep remaining scope explicit.

### Next concrete work

1. Extend the host C++ fixture to retain a real `Runtime` across an ordered sequence of events/frames and apply actual `Report` screen changes after rendering. Keep snapshot tests working. Compare browser/native visible pixels, page/mode and brightness, not only an independently duplicated calculation.
2. Add timeline regressions that demonstrate delayed frames, Clock/Date transitions, message expiry between housekeeping ticks, interrupted-cycle resume, preference changes, and uint32 rollover. Add animation timeline coverage where justified; do not claim untested overlay/countdown parity.
3. Integrate/rework `PreviewTimeline` into the live preview with a monotonic runtime source, keeping civil time/timezone separate. Advance persistent state once per logical frame; settled and animated render paths must not consume it twice.
4. Run code-only gates. Install snapshot-excluded lightweight dependencies/npm if absent. Local Python was 3.11; exact SDK requires 3.12-3.14. Do not downgrade the SDK or retry firmware builds.

Useful reduced gate after dependencies are available:

```sh
npm --prefix web-configurator ci --ignore-scripts
# Lightweight local Python dependencies previously used: PyYAML==6.0.3,
# freetype-py==2.5.1, fonttools==4.66.1 in .cache/code-test-deps.
PYTHONPATH="$PWD/.cache/code-test-deps${PYTHONPATH:+:$PYTHONPATH}" python3 scripts/check_code.py --skip-sdk-checks
```

This is reduced coverage, not local exact-SDK freshness or firmware validation. Full code-only hosted CI checks SDK imports/freshness. Do not run `scripts/validate.py` or `validate-release-offline.sh` through firmware paths; the latter also has unsafe whole-checkout copying.

5. Update `ROADMAP.md`, `REPORT.md`, `VALIDATION.md`, `tasks/todo.md` and appropriate README status with exact evidence/pending scope; correct step 4 hosted-pending statements. Commit/push only the permitted Arena branch, update PR #13 body/comment once, and check hosted CI metadata without repeating an already-delivered step.

## Original acceptance criteria still apply

- Exactly two default external fonts: Pixel Clock 6x8 + Matrix 2px; Compact 5x7 built in; compatible extras opt-in/unlimited. Preserve repaired Matrix zero upper-left 2 px stroke without redesign.
- Smooth changed-digit-only slides; unchanged digits/colons stationary; preserve HA animation duration/gap controls and regression coverage.
- Configure contains controls/live preview; detailed documentation/hardware/troubleshooting live in Info & Help. Installer resolves newest published immutable release, never main/a hard-coded older tag.
- Derive settings/defaults/fonts/entities/modules/version/release metadata from real firmware; deploy UI and installer from the same validated publishing SHA.
- Secure OTA start/progress/bar/success/error remain visible while ESPHome's normal loop is blocked; installed-version boot splash; no exposed credentials.
- Main-push automation is guarded and tested in code, but actual publication/deployment and physical-device validation need explicit approval/evidence later. No firmware binary, hardware/sign-off, or live deployment was completed under this code-only instruction.

Canonical contract at `dd1037f`: schema 1, 44 settings, 48 entities, 6 actions; source hash `36e4b007826cddf98572c1f71825cda5695948a615f451818a7240752149e333`. Do not hand-edit generated contracts/headers/glyphs. Release-note metadata still needs refresh before a public release; preserve exact browser/publisher release-body formatting.

## Git/workspace warning

The sandbox has repeatedly recreated local Git history at base `e693db4` while preserving newer source files. This happened again during handoff. Recovery fetched the Arena branch, staged everything **except the untracked Step 5 file**, confirmed the staged completed-work tree **exactly matched** `FETCH_HEAD^{tree}`, then used `git reset --soft FETCH_HEAD`. Nothing was discarded; no hard reset/force push was used. After recovery, only `previewTimeline.ts` was untracked before this handoff document was created.

If it happens again, inspect status/history and preserve all deltas. Do not treat the apparent base commit as the latest implementation; fetch the existing branch. Restore history only after proving tree equality, or preserve/reconcile real WIP differences explicitly. Never delete/rename/move the repository root or `.git`.
