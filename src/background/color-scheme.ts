/**
 * Follows the browser's color scheme, so the toolbar icon can switch between
 * its light and dark variants.
 *
 * Firefox runs the background script in a page, which has matchMedia. Chrome's
 * service worker does not, so an offscreen document watches the media query
 * there and reports it with a ColorScheme message.
 */
import { ext } from '../shared/browser';
import type { ColorScheme } from '../shared/messages';
import { setToolbarScheme } from './toolbar-icon';

const DARK_QUERY = '(prefers-color-scheme: dark)';
const OFFSCREEN_PAGE = 'offscreen.html';

export function watchColorScheme(): void {
  if (typeof matchMedia === 'function') {
    const query = matchMedia(DARK_QUERY);
    const report = () => setToolbarScheme(schemeOf(query.matches));
    report();
    query.addEventListener('change', report);
    return;
  }

  ensureOffscreenDocument();
}

function schemeOf(dark: boolean): ColorScheme {
  return dark ? 'dark' : 'light';
}

async function ensureOffscreenDocument(): Promise<void> {
  if (!ext.offscreen) return;

  try {
    await ext.offscreen.createDocument({
      url: OFFSCREEN_PAGE,
      reasons: [ext.offscreen.Reason.MATCH_MEDIA],
      justification: 'Matches the toolbar icon to the light or dark browser theme.'
    });
  } catch {
    // Already open: only one offscreen document is allowed, and it outlives
    // the service worker.
  }
}
