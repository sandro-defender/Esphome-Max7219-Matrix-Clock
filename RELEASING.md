# Code-only release and Pages pipeline

This is candidate source wiring, not evidence of an executed release or device
validation. The user explicitly deferred ESPHome config, build, code generation
and compilation. No firmware binary, flash/RAM result or hardware sign-off is
produced by this pipeline.

## Events and boundaries

`.github/workflows/validate-code.yml` validates every main push and PR, without
path filters. Manual runs validate only. PRs/forks cannot publish or deploy;
publication jobs require this repository's `push` to `refs/heads/main`.

| Job | Dependency | Permissions |
| --- | --- | --- |
| checks | none | contents: read |
| publish | successful checks | contents: write |
| site | successful checks + publish | contents: read, pages: read |
| deploy | successful publish + ready site | contents: read, pages: write, id-token: write |

All Actions are SHA-pinned; checkout credentials are not persisted. Only the
publisher/read-only verification steps receive Actions' built-in `github.token`.
No custom API/SSH credential or user PAT is needed. Pages must already be enabled;
the workflow does not change repository settings or auto-enable it.

## Immutable versioned source/YAML releases

`publish_release.py` verifies main-push provenance, exact checkout SHA and clean
source. The first commit at a canonical version reserves `VERSION`; later
commits use `VERSION+12hexSHA`. Ref creation is atomic, collisions fail, and
existing refs are never moved. Repeating a completed commit verifies content
without editing published notes/assets, even when server locking is disabled.

The installer asset comes from the actual browser YAML generator, with local
`!secret` references only. Notes come from the source-generated firmware
contract. A draft receives its installer before publication; metadata and asset
bytes/digests are checked before and after publication. Wrong existing drafts
fail instead of destructively clobbering. No `.bin` artifact is published.

The old tag-only auto-notes workflow was removed so it cannot race tag
reservation or create an incompatible release. Tags created by the publisher
are not an independent validation/publication trigger.

## Matching Pages and stale-retry protection

The site job checks out the exact validated publishing SHA, verifies that its
tag is still newest by **publication time**, and compares release notes and the
published installer with freshly generated YAML. Only then does it build the
web bundle with `VITE_RELEASE_COMMIT` and upload a run/attempt-specific artifact.
No glyph/source data is silently regenerated during site creation.

The deploy job holds the `pages` concurrency lock and repeats the read-only
newest-tag/SHA/notes/installer check immediately before deploying the matching
artifact. A superseded publication skips; malformed/offline/mismatched responses
fail closed. PR/manual runs and failed validation/publication never reach Pages.
The browser independently verifies tagged source/notes/SHA before export, so a
stale open page cannot silently install different firmware.

There is no atomic transaction across GitHub release publication and Pages.
Publication can change after the final read; the browser's commit gate remains
the final fail-closed protection during deployment lag. GitHub may supersede
pending Pages jobs; release publication and main validation use per-commit groups.

## Current evidence / next approval

Publisher tests mock git/gh/npm. Deployment tests mock all remote operations and
block real subprocesses. Workflow contract tests check events, dependency order,
permissions, pinned Actions, SHA/artifact propagation and firmware-CLI absence.

Real publication, Pages environment permissions/approvals, live installer fetch,
rerun behavior and deployment lag still need integration verification after
explicit approval. Refresh current release-note metadata before a public release.
Full firmware compilation, size/headroom and real boot/OTA/animation checks
remain separate deferred gates. Keep the PR a draft until those limitations
are signed off; source wiring alone is not a completed hardware release.
