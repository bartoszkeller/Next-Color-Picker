# Contributing

## Development

Requires Node.js 22 or newer.

```sh
npm install
npm run dev            # build both browsers into dist/ and rebuild on changes
npm run start:chrome   # launch Chrome with the extension from dist/chrome
npm run start:firefox  # launch Firefox with the extension from dist/firefox
```

The browsers started by `start:*` reload the extension on every rebuild. To load a build by hand:

- **Chrome:** `chrome://extensions` → _Developer mode_ → _Load unpacked_ → `dist/chrome`.
- **Firefox:** `about:debugging#/runtime/this-firefox` → _Load Temporary Add-on_ → `dist/firefox/manifest.json`.

Before opening a pull request, run `npm run check`, which CI runs as well.

### Scripts

| Script                 | Description                                                          |
| ---------------------- | -------------------------------------------------------------------- |
| `npm run build`        | Release build of both browsers into `dist/chrome` and `dist/firefox` |
| `npm run build:chrome` | Release build of a single browser (also `build:firefox`)             |
| `npm run dev`          | Development build with source maps, rebuilt on changes               |
| `npm run typecheck`    | Type-checks the sources with TypeScript                              |
| `npm run lint`         | Lints the sources with oxlint                                        |
| `npm run lint:firefox` | Validates the Firefox build with the addons.mozilla.org linter       |
| `npm run format`       | Formats all files with Prettier (`format:check` only checks)         |
| `npm run check`        | All of the above                                                     |
| `npm run package`      | Builds and packs store-ready archives into `artifacts/`              |
| `npm run clean`        | Removes `dist/` and `artifacts/`                                     |

## How it works

The picker is injected into the active tab when the toolbar button is clicked. It asks the background script for a screenshot of the visible tab and samples colors from it, so no host permissions are needed. The screenshot is retaken after the page scrolls or resizes.

Chrome and Firefox builds come from the same source. The manifest is `src/manifest/base.json` merged with `chrome.json` or `firefox.json`, and browser differences are handled by feature detection:

- **Background script.** A service worker in Chrome, an event page in Firefox.
- **Toolbar icon.** In Chrome the icon is grey by default and turns colored on supported pages through a `declarativeContent` rule. Firefox has no `declarativeContent`, so its icon is always colored and turns grey briefly when the picker cannot run.
- **Settings menu entry.** Chrome lists the options page in the toolbar button's menu by itself; in Firefox it is added through the `menus` API.

### Project structure

```
src/
├── background/       Background script: injection, screenshots, toolbar icon and menu
├── content/picker/   The picker overlay, injected into the page
├── options/          The settings page
├── shared/           Code and styles used by all of the above
├── manifest/         Manifest parts, merged per browser
└── types/            Global type declarations
public/               Copied as-is into every build
scripts/              Build and packaging scripts
```

## Releasing

On a clean `main` branch, run one of:

```sh
npm version patch   # 1.0.0 → 1.0.1
npm version minor   # 1.0.0 → 1.1.0
npm version major   # 1.0.0 → 2.0.0
```

This runs `npm run check`, bumps the version in `package.json` (the only place the version is set), commits it as `Release v<version>`, tags it and pushes both. CI then publishes a GitHub release with the commits since the previous release and three archives:

- `next-color-picker-<version>-chrome.zip` for the Chrome Web Store,
- `next-color-picker-<version>-firefox.zip` for addons.mozilla.org,
- `next-color-picker-<version>-source.zip`, the source code that addons.mozilla.org requires for bundled code. It builds with `npm ci && npm run build`.
