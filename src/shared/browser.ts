/**
 * The WebExtension API of the current browser.
 *
 * Firefox exposes its promise-based API as `browser`; Chrome only has `chrome`,
 * which returns promises in Manifest V3 as well. Everything this extension uses
 * has the same shape in both, so the Chrome typings describe either one.
 *
 * Optional APIs, such as `declarativeContent`, must be feature-detected.
 */
export const ext: typeof chrome = globalThis.browser ?? globalThis.chrome;
