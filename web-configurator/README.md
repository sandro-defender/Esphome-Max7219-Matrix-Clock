# MAX7219 Matrix Clock Web Configurator

A client-side React/Vite configurator for the ESPHome MAX7219 Matrix Clock in
this repository. It provides a live matrix preview and downloads one small
installation YAML backed by the version-pinned modules in `../packages/`.

## What “one YAML” means

The downloaded device file is the only YAML an end user needs to maintain. It
contains local `!secret` references, substitutions, first-boot preferences and
the complete remote `packages` declaration. During validation and compilation,
ESPHome downloads the modular firmware and fonts from the matching repository
release.

The configurator does not copy the complete renderer into every generated file.
That keeps the one-file installation path synchronized with the tested modular
firmware instead of creating a second implementation that can drift.

## Security

The browser never asks for Wi-Fi, API, OTA or web-server credentials. Generated
files refer to entries in the user's local `secrets.yaml`. No credential is
stored in JavaScript, browser storage, generated YAML or this repository.

## Development

```text
npm install
npm test
npm run typecheck
npm run dev
```

Create a production build with:

```text
npm run build
```

The Vite single-file plugin emits `dist/index.html`. Build output and
`node_modules` are ignored by Git.

## GitHub Pages

The repository-level workflow
[`../.github/workflows/deploy-configurator.yml`](../.github/workflows/deploy-configurator.yml)
installs dependencies, runs the YAML-generator tests, type-checks the app,
builds it and deploys `web-configurator/dist` to GitHub Pages.

## Generated firmware contract

The generator pins package YAML and web-font assets to the same release tag. It
includes the same module list as `../examples/release.yaml`:

* base device and network/API configuration;
* renderer and MAX7219 display bridge;
* repository-hosted Tiny5 and Press Start 2P fonts;
* Home Assistant controls and API actions;
* diagnostics and on-matrix OTA progress;
* authenticated web server with browser-based OTA disabled.

Update the generator tests whenever the release package list or substitution
contract changes.
