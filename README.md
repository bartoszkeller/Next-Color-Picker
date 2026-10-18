<p align="center">
  <img src="public/icons/icon128.png" width="96" height="96" alt="" />
</p>

<h1 align="center">Next Color Picker</h1>

<p align="center">
  Pick any color on the web, pixel-perfect, in one click.<br />
  For Chrome and Firefox.
</p>

<p align="center">
  <a href="https://github.com/bartoszkeller/Next-Color-Picker/releases/latest"><img src="https://img.shields.io/github/v/release/bartoszkeller/Next-Color-Picker?label=release&color=18181b" alt="Latest release" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/bartoszkeller/Next-Color-Picker?color=18181b" alt="License" /></a>
</p>

---

Next Color Picker is a lightweight eyedropper that stays out of your way. Click the toolbar button and a magnifier follows your cursor, showing the exact pixel under it. Click once and the color is on your clipboard, ready to paste into your CSS, design tool or code.

It samples what is actually rendered on screen, so it works on everything a page can show: text, images, videos, gradients, canvas and SVG.

## Features

- **Pixel-perfect magnifier.** An 11× zoomed lens with a pixel grid, so you always know exactly which pixel you are picking.
- **Four color formats.** HEX, RGB, HSL and OKLCH, all valid CSS. Switch between them with <kbd>Ctrl</kbd> + scroll while picking.
- **Keeps up with the page.** Scroll while the picker is open, including inside scrollable panels, without losing your place.
- **Remembers your format.** Opens in the format you used last time, or in a fixed default of your choice.
- **Light and dark.** Follows your system theme, or set one in the settings.
- **Private by design.** No access to your browsing data, no tracking, no network requests.

## How to use

1. Click the **Next Color Picker** button in the toolbar.
2. Move the cursor to the color you want.
3. Click to copy it.

| Action            | Shortcut                                                 |
| ----------------- | -------------------------------------------------------- |
| Copy the color    | Click, <kbd>Enter</kbd> or <kbd>Space</kbd>              |
| Switch the format | <kbd>Ctrl</kbd> + scroll                                 |
| Scroll the page   | Scroll                                                   |
| Cancel            | <kbd>Esc</kbd>, right click, or the toolbar button again |

## Settings

Right-click the toolbar button and choose **Options** in Chrome, or **Settings** in Firefox.

- **Remember last format.** On by default. Turn it off to always start in a default format of your choice.
- **Theme.** System, light or dark.

## Installation

Download the latest version from the [Releases](https://github.com/bartoszkeller/Next-Color-Picker/releases/latest) page.

**Chrome, Edge, Brave and other Chromium browsers (99 or newer)**

1. Unzip `next-color-picker-<version>-chrome.zip`.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.

**Firefox (140 or newer)**

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on** and select `next-color-picker-<version>-firefox.zip`.

Firefox removes temporary add-ons when it restarts; a permanent install will be possible once the extension is listed on addons.mozilla.org.

## Privacy

Next Color Picker collects no data and makes no network requests. It only runs on a tab after you click its button, and the screenshots it samples colors from never leave your browser. Your settings are stored locally.

| Permission                         | Used for                                                 |
| ---------------------------------- | -------------------------------------------------------- |
| `activeTab`                        | Reading the colors of the current tab, after you click   |
| `scripting`                        | Showing the magnifier on the page                        |
| `storage`                          | Saving your settings                                     |
| `declarativeContent` (Chrome only) | Showing the colored icon on pages where the picker works |
| `menus` (Firefox only)             | Adding **Settings** to the toolbar button's menu         |

Some pages do not allow extensions to run, such as browser settings, extension stores and the built-in PDF viewer. There, the icon turns grey.

## Contributing

Bug reports and ideas are welcome in [Issues](https://github.com/bartoszkeller/Next-Color-Picker/issues). To build the extension yourself, see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[GPL-3.0-or-later](LICENSE) © Bartosz Keller
