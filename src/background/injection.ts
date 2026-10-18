import { ext } from '../shared/browser';
import { showRestrictedNotice } from './popup';

/** Bundled content script, see src/content/picker. */
const PICKER_SCRIPT = 'picker.js';

/** Pages on which browsers never allow extensions to run. */
const RESTRICTED_HOSTS = new Set([
  'chromewebstore.google.com',
  'chrome.google.com',
  'addons.mozilla.org',
  'microsoftedge.microsoft.com'
]);

/**
 * Injects the picker into the tab. Injecting again while it is open closes it,
 * so the toolbar button acts as a toggle.
 */
export async function injectPicker(tab: chrome.tabs.Tab): Promise<void> {
  if (!tab.id) return;

  // Known restricted pages get the notice right away, while the click still
  // counts as a user action; Firefox opens the popup only then.
  if (!canInject(tab.url)) {
    showRestrictedNotice(tab.id);
    return;
  }

  try {
    await ext.scripting.executeScript({ target: { tabId: tab.id }, files: [PICKER_SCRIPT] });
  } catch {
    // Pages that only reject the injection itself, such as the built-in PDF
    // viewer or file URLs without file access granted.
    showRestrictedNotice(tab.id);
  }
}

/** The URL is readable here through the activeTab grant; without one, injection is attempted. */
function canInject(url: string | undefined): boolean {
  if (!url) return true;

  try {
    const { protocol, hostname } = new URL(url);
    return /^(https?|file):$/.test(protocol) && !RESTRICTED_HOSTS.has(hostname);
  } catch {
    return false;
  }
}
