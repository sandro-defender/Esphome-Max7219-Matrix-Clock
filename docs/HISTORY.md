# History

Why the project looks the way it does. Dates and versions are verifiable in Git,
the GitHub releases and deployments; nothing here is a promise about current
behaviour — that is [README.md](../README.md).

## 2026-09-28 — first releases and the modular migration

The clock started as one large YAML entry point
(`esphome_Max7219-Matrix-Clock/max7219-clock.yaml`). It was split into the
modules under `packages/` (base, network, display, controls, actions,
diagnostics, OTA UI, web server, renderer headers) so a user YAML only carries
credentials, substitutions and the package list. Releases `0.0.1`, `0.1.0` and
`0.1.1` followed on the same day; the single-file entry point was deleted and is
not a valid path in this repository.

## 2026-09-29 — fonts become a policy

Matrix 2px was added as a generated pixel face with two-pixel strokes, and the
renderer learned per-digit, changed-digit-only slide-up animation. Font handling
settled on: generated or licensed source files under `fonts/`, per-face release
packages under `packages/fonts/*.yaml`, one `-DMAX7219_FONT_*` build flag per
face, `bpp: 1`, and a restricted glyph set (digits, separators and status
characters). Messages fall back to the built-in Compact 5×7 face. Licences stay
beside the assets: OFL texts for Quantico and the Georgian Noto families,
LGPL-2.1-or-later notices for the MD_MAX72XX/MD_Parola conversions, generator
scripts for the project-made faces.

## 2026-09-30 — release 0.4.0 and the first measured builds

Release `0.4.0` (tag `7c85cc49ec9c01c08adc26be9b2905ed85b9bd96`) was validated
with cloned and offline release paths, and compiled with ESPHome **2026.9.0**
(ESP8266 Arduino 3.1.2). That run produced the only flash/RAM table the project
has: default two-face builds used 505,141 B flash (48.4%) and 41,276 B RAM
(50.4%) on `d1_mini`. The measurements are historical: the toolchain, the
default font pair and the catalogue have changed since, so they must not be
presented as current ([packages/fonts/README.md](../packages/fonts/README.md)).

## 2026-10-01/02 — target 2026.9.1 and the web configurator

The firmware target moved to **ESPHome 2026.9.1 exactly** (`min_version` and
`requirements-validation.txt`). The static configurator grew into the primary
install path: a one-file generator, pixel-exact previews from the compiled
glyph sets, share links, and a fail-closed check of the newest published release
before the installer can be copied. Generated artifacts — firmware contract,
glyph bitmaps, local font wrappers, example YAMLs — became CI-enforced
freshness checks after "Firmware/configurator drift" failures caused by editing
a hashed file without regenerating.

Font policy also changed: the default build became **Pixel Clock 6×8 +
Matrix 2px** (Compact 5×7 built in), with Dot Matrix, MD Parola Numeric
7-Segment and MD MAX72XX System optional and no selection cap. Older examples
that mention a Matrix 2px + Dot Matrix default are outdated.

## 2026-10-02 — hand-made release 0.7.0

A release `0.7.0` was created by hand in the GitHub UI at
`0fee96cb8acfa7a114ca62cc75d94a20294b40e6`, a main commit whose CI run failed.
It has no installer asset and auto-generated notes. Because the configurator
checks the newest release's notes against `## <tag>` plus the CHANGELOG section,
its tag-to-commit resolution and the generated installer asset, that release can
never verify. It is intentionally ignored; the next workflow release becomes
newest by `published_at` (GitHub's "Latest" marker is not used).

## 2026-10-02 — 0.7.1, the quota incident and deleted tags

Users reported "Release lookup failed (403)" in the configurator. The cause was
GitHub's anonymous REST quota: **60 requests per hour per IP address**, shared
by everyone behind the same NAT/VPN, with `304` responses still counted. The
page had re-verified on every tab switch and reload. The fix (released as
`0.7.1` by the main-push workflow from
`455edc5f463ce75fb32f7fc7937af4a5895bf866`, installer asset
`max7219-clock.yaml`, Pages deployed from the same commit) was to spend fewer
requests: reuse a verification for 5 minutes on focus/reload, re-check every
15 minutes in the background, share one check across consecutive exports, and
turn a throttled response into a visible pause with an automatic retry time
instead of an opaque failure.

In the same period the per-commit tags from the immutable scheme — for example
`0.7.0+3c26328002e0`, whose successful main-push run deployed main commit
`3c26328002e0bd001c07623ae5dbeb46538fa28a` to Pages at 2026-10-02T08:13:34Z —
were deleted by hand "to clean up". The deployed site was
then left without a release matching the scheme, and the tag is now gone
(GitHub returns 404). Lesson: release tags are the publication scheme, not junk.
They are immutable, only the main-push workflow may create them, and deleting
one leaves the deployed site without a matching release.

That incident also ended the `X.Y.Z+<12-hex-sha>` scheme: per-commit tags
multiplied look-alike releases, and a deleted one could not be told apart from a
version that had never been published. Releases now always bump the patch
version, so every tag is a plain `X.Y.Z` that belongs to exactly one commit.

## 2026-10-02 — documentation consolidation

Session documents had accumulated stale branch names, draft-PR numbers and
"candidate" status text that was wrong within a day. `AGENT_HANDOFF.md`,
`REPORT.md`, `tasks/todo.md`, `tasks/plan.md` and `web-configurator/REDESIGN.md`
were removed; their still-true content folded into
[AGENTS.md](../AGENTS.md), [ROADMAP.md](../ROADMAP.md),
[VALIDATION.md](../VALIDATION.md), [RELEASING.md](../RELEASING.md) and
[web-configurator/README.md](../web-configurator/README.md). The 0.6.x
CHANGELOG entry that points at `web-configurator/REDESIGN.md` stays as written:
released CHANGELOG sections are published release notes and part of the
firmware-contract hash, so they are never rewritten. The design contract from
that file now lives here and in the configurator README.

## Verification limits

Firmware compilation has repeatedly failed in sandboxes because the PlatformIO
toolchain host was blocked (`SSLEOFError` / `HTTPClientError` while downloading
`platformio/espressif8266@4.2.1`), and toolchain downloads have been explicitly
out of scope at times. As a consequence CI validates sources, generated
artifacts, host C++ and the web app — it does not compile or flash firmware, and
no current flash/RAM or on-device result exists. See
[VALIDATION.md](../VALIDATION.md#what-ci-never-verifies).
