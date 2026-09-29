# Implementation Plan: Reliability, configurator, and release improvements

## Overview

Improve the clock animation and configurator layout, make firmware identity and
time fallback visible, and introduce safe release-update awareness. Public
installs remain pinned to a published release; “latest” means the newest
published release tag, never an unpinned development branch.

## Architecture decisions

- Fix renderer behaviour before changing the browser preview, then keep both
  paths under shared regression tests.
- Treat GitHub update data as untrusted network input: fetch only a small,
  versioned release manifest over HTTPS, parse bounded fields, and fail closed.
- Keep Home Assistant time preferred. Use a configurable, bounded list of
  public SNTP servers only when Home Assistant time is invalid.

## Task list

See [todo.md](todo.md) for the ordered, testable work items and checkpoints.

## Risks

| Risk | Mitigation |
|---|---|
| Slide animation corrupts adjacent digits | Add frame-by-frame renderer tests before changing motion code. |
| Joined configurator matrices change physical mapping | Test both normal and module preview layouts at module boundaries. |
| Update checks waste ESP8266 resources | Check infrequently, impose response/time limits, and publish only changes. |
| “Latest” becomes unreproducible | Resolve it to an immutable release tag at YAML generation time. |
