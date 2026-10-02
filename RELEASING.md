# Releasing and publishing

**Every push to `main` publishes a release and redeploys Pages**, including a
documentation-only change. The pipeline is
[`.github/workflows/validate-code.yml`](.github/workflows/validate-code.yml);
it publishes source/YAML installers, never firmware binaries.

## What a main push does

| Job | Runs when | Does |
| --- | --- | --- |
| `checks` | every main push and PR | full code gate (`scripts/check_code.py`): exact-SDK freshness, host tests, web tests, typecheck, production web bundle |
| `publish` | main push, after `checks` | `scripts/publish_release.py`: reserve tag, build the installer asset, create a draft, verify notes/assets, publish, verify again |
| `site` | main push, after `publish` | `scripts/verify_deployment.py` re-checks the newest publication, then builds `web-configurator/dist` with `VITE_RELEASE_COMMIT` |
| `deploy` | main push, after `site` reports ready | holds the `pages` lock, rechecks the newest publication, deploys the matching artifact |

PRs, forks and manual runs execute `checks` only; they can never publish or
deploy. All Actions are SHA-pinned and checkouts do not persist credentials.

## Tag scheme (immutable)

* First commit at a version: `X.Y.Z` (for example `0.7.1` at
  `455edc5f463ce75fb32f7fc7937af4a5895bf866`).
* Later commits at the same version: `X.Y.Z+<12-hex-sha>` (for example
  `0.7.0+3c26328002e0`). A `+`-tag must resolve to a commit starting with that
  12-hex prefix.
* Tags are never moved. A repeated run for the same commit re-verifies the
  existing tag and never edits published notes or assets.
* Tags and releases are **only** created by the publisher. Deleting them by hand
  leaves the deployed site with no matching release — that has already happened
  once ([docs/HISTORY.md](docs/HISTORY.md)).

A release is installable only when it is the **newest published** (non-draft,
non-prerelease) versioned release by `published_at`. GitHub's "Latest" marker
and the version number are ignored on purpose: the hand-made `0.7.0` release is
newer by creation time but older by publication and cannot verify.

## What the browser verifies before enabling the installer

`web-configurator/src/release.ts` checks, in order:

1. newest published versioned release by `published_at` (bounded pagination,
   strict metadata, no fallback to an older release);
2. its base version equals the version compiled into the page;
3. the tag's `web-configurator/src/firmware.generated.json` has the same
   repository, ESPHome version, schema version, `sourceHash` and release
   version;
4. the release body equals `## <tag>` plus the CHANGELOG section;
5. the tag resolves to a commit within 4 annotated-tag levels, with no cycle,
   and `X.Y.Z+sha12` matches the commit prefix;
6. the page's own `VITE_RELEASE_COMMIT` equals that commit, so a stale open page
   says "A newer configurator has been published. Refresh this page." instead of
   installing a different source tree.

Only then is the copy/download button enabled, and each export repeats the
check (reusing a verification younger than 30 s). A paused or unverified release
always fails closed.

## Anonymous API quota

The browser calls `api.github.com` **without a token**: 60 requests per hour
**per IP address**, shared by everyone behind the same NAT, VPN or carrier
gateway. An HTTP 304 still consumes quota. "Release lookup failed (403)" in the
configurator was quota exhaustion, not a broken repository.

* One verification costs two requests (release list, tag object).
* Results are reused: re-check every 15 minutes (`RECHECK_MS`), reuse on tab
  focus/reload a result younger than 5 minutes (`FRESH_MS`), and share one
  pre-export check for 30 seconds (`INSTALL_FRESH_MS`).
* On 403/429 with `x-ratelimit-remaining: 0` the page shows a timed pause
  ("Automatic retry at HH:MM", from `Retry-After` or `x-ratelimit-reset`,
  default 5 minutes, capped at 65 minutes) and retries by itself; the status
  line offers a manual Retry.
* The fix for quota pressure is **fewer requests**, never an embedded token: any
  token shipped in a public page is a leaked credential.

## Recovery without hand-made releases

| Situation | Do this |
| --- | --- |
| Main-push run failed before publishing | Re-run the failed jobs of that run. Re-runs keep the original push event, and the publisher is idempotent for the same commit. |
| Publisher failed halfway (draft exists) | Re-run the same run: the draft is re-verified, missing assets are uploaded, then it is published. A mismatched draft fails instead of being overwritten. |
| A workflow tag is missing after a manual deletion | Re-run the publisher for that commit; it recreates the same immutable tag name and verifies the content. Never create it by hand. |
| A hand-made release is newest | Publish the next workflow version (bump `project_ref` + CHANGELOG section). The hand-made release is then ignored, exactly as `0.7.1` superseded `0.7.0`. Never edit or delete it. |
| Pages is stale or the deploy job failed | Re-run the failed jobs of the newest main-push run, or push a new commit (every push publishes). Do not touch releases, tags or the Pages artifact. |
| Release notes or the installer asset look wrong | Fix the source (`CHANGELOG.md` section, package or generator), bump `project_ref`, and publish a new release. Published notes/assets are immutable. |

Never: create/edit/delete/re-publish releases or tags by hand, move a tag, force-
push `main`, upload assets manually, or enable/disable Pages from the workflow.

## Release-worthy changes

A firmware change that users should be able to install needs, in one PR:

1. the source change,
2. `project_ref` bumped in `packages/base.yaml`,
3. a matching `## <version>` section in `CHANGELOG.md`,
4. a regenerated contract (`python scripts/generate_firmware_contract.py`) when
   a hashed file changed ([AGENTS.md](AGENTS.md)).

Merging then publishes `X.Y.Z` if that version is new, otherwise
`X.Y.Z+<12-hex-sha>`, and redeploys Pages from the same commit.
