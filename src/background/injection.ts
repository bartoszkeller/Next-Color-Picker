import { ext } from '../shared/browser';
import { flashBlockedIcon } from './icons';
import { hasPageRules, isSupportedUrl } from './page-rules';

/** Bundled content script, see src/content/picker. */
const PICKER_SCRIPT = 'picker.js';

/**
 * Injects the picker into the tab. Injecting again while it is open closes it,
 * so the toolbar button acts as a toggle.
 */
export async function injectPicker(tab: chrome.tabs.Tab): Promise<void> {
  if (!tab.id) return;

  try {
    await ext.scripting.executeScript({ target: { tabId: tab.id }, files: [PICKER_SCRIPT] });
  } catch {
    // With page rules, internal pages already show the grey icon, so the click
    // is ignored there. Some web pages reject injection as well, e.g. the
    // extension stores, the built-in PDF viewer, or file URLs without file
    // access granted; there the icon turns grey briefly. Without page rules
    // (Firefox) the icon is always colored, so every failure gets the feedback.
    if (hasPageRules && !isSupportedUrl(tab.url)) return;

    flashBlockedIcon(tab.id);
  }
}
