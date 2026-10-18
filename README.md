# Next Color Picker

A minimal color picker for Chrome and Firefox. A magnifier follows your cursor, a click copies the color of the pixel under it.

## Usage

1. Click the toolbar button.
2. Move the cursor over the page; the lens shows the zoomed pixels and the color of the center one.
   Scroll as usual to reach other parts of the page; the picker stays open.
3. Switch the color format with <kbd>Ctrl</kbd> + mouse wheel: HEX, RGB, HSL or OKLCH.
   The last format used is remembered.
4. Copy the color with a **click**, <kbd>Enter</kbd> or <kbd>Space</kbd>.
   Cancel with <kbd>Esc</kbd>, a right click, or the toolbar button again.

## Browser support

| Browser         | Minimum version | Background script |
| --------------- | --------------- | ----------------- |
| Chrome          | 99              | Service worker    |
| Firefox desktop | 140             | Event page        |
| Firefox Android | 142             | Event page        |

Both builds come from the same source. The differences are confined to the manifests in [src/manifest/](src/manifest/) and to feature detection at runtime:

- **Toolbar icon.** In Chrome the icon is grey by default and turns colored on pages where the picker can run, via a `declarativeContent` rule. Firefox has no `declarativeContent`, so its icon is always colored and turns grey briefly when the picker cannot run in a tab.
- **API namespace.** The code uses `browser` in Firefox and `chrome` in Chrome, see [src/shared/browser.ts](src/shared/browser.ts).

## Permissions

| Permission           | Why                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------ |
| `activeTab`          | Injects the picker and captures the visible tab, only after the toolbar button click |
| `scripting`          | Injects the picker script                                                            |
| `storage`            | Remembers the chosen color format, locally in the browser                            |
| `declarativeContent` | Chrome only: shows the colored icon on supported pages without reading tab URLs      |

No host permissions are requested and no data is collected; the color format never leaves the browser.

## Development

Requires Node.js 22 or newer.

```sh
npm install
npm run dev            # build both browsers into dist/ and rebuild on changes
npm run start:firefox  # launch Firefox with the extension from dist/firefox
npm run start:chrome   # launch Chrome with the extension from dist/chrome
```

The browsers started by `start:*` reload the extension automatically on every rebuild. Alternatively, load it by hand:

- **Chrome:** `chrome://extensions` → enable _Developer mode_ → _Load unpacked_ → select `dist/chrome`.
- **Firefox:** `about:debugging#/runtime/this-firefox` → _Load Temporary Add-on_ → select `dist/firefox/manifest.json`.

### Scripts

| Script                 | Description                                                          |
| ---------------------- | -------------------------------------------------------------------- |
| `npm run build`        | Release build of both browsers into `dist/chrome` and `dist/firefox` |
| `npm run build:chrome` | Release build of a single browser (also `build:firefox`)             |
| `npm run dev`          | Development build with source maps, rebuilt on changes               |
| `npm run typecheck`    | Type-checks the sources with TypeScript                              |
| `npm run lint`         | Lints the sources with oxlint                                        |
| `npm run lint:firefox` | Validates the Firefox build with the AMO linter                      |
| `npm run format`       | Formats all files with Prettier (`format:check` only checks)         |
| `npm run check`        | All of the above, as run by CI                                       |
| `npm run package`      | Builds and packs store-ready archives into `artifacts/`              |
| `npm run clean`        | Removes `dist/` and `artifacts/`                                     |

### Project structure

```
src/
├── background/          Background script
│   ├── index.ts         Entry point, registers the listeners
│   ├── injection.ts     Injects the picker on toolbar button clicks
│   ├── capture.ts       Captures the visible tab for the picker
│   ├── page-rules.ts    Chrome-only colored icon on supported pages
│   └── icons.ts         Toolbar icon sets and feedback
├── content/picker/      Picker overlay, injected into the page
│   ├── index.ts         Entry point, toggles the picker
│   ├── color-picker.ts  Overlay, lens and color sampling
│   ├── template.ts      Overlay markup
│   ├── color-formats.ts HEX, RGB, HSL and OKLCH conversions
│   ├── scrolling.ts     Scrolls page content under the overlay
│   ├── settings.ts      Remembered preferences
│   ├── screenshot.ts    Requests and decodes tab screenshots
│   ├── clipboard.ts     Copies with a fallback for restricted pages
│   ├── toast.ts         Error messages
│   ├── state.ts         State shared between injections
│   ├── constants.ts     Sizes, timings and limits
│   ├── utils.ts         DOM and color helpers
│   └── styles/          Shadow DOM stylesheets
├── manifest/            base.json, merged with chrome.json or firefox.json
├── shared/              Code used by both scripts
└── types/               Global type declarations
public/                  Copied as-is into every build (icons)
scripts/                 Build and packaging scripts
```

## Releasing

On a clean `main` branch, run one of:

```sh
npm version patch   # 1.0.0 → 1.0.1
npm version minor   # 1.0.0 → 1.1.0
npm version major   # 1.0.0 → 2.0.0
```

This runs `npm run check`, bumps the version in `package.json` and `package-lock.json` (the single source of truth for the manifests), commits it as `Release v<version>`, creates the `v<version>` tag and pushes both. CI then checks the code again and attaches three archives to a GitHub release:

- `next-color-picker-<version>-chrome.zip` for the Chrome Web Store,
- `next-color-picker-<version>-firefox.zip` for addons.mozilla.org,
- `next-color-picker-<version>-source.zip`, the source code that AMO asks for because the scripts are bundled and minified. It can be rebuilt with `npm ci && npm run build`.

## License

[GPL-3.0](LICENSE)
