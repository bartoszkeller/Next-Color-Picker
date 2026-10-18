/**
 * The extension popup holds the settings and the notice for pages the picker
 * cannot run on. Clicking the toolbar button starts the picker, so the popup
 * is only set for the moment it is opened.
 *
 * Firefox opens the popup only while it handles a user action, so openPopup
 * is called synchronously from the click listeners; nothing may be awaited
 * before it.
 */
import { ext } from '../shared/browser';

const POPUP_PAGE = 'popup.html';
const SETTINGS_WINDOW = { width: 380, height: 620 };

/** How long the badge fallback for the notice is shown, in ms. */
const BADGE_DURATION = 2000;

export function openSettings(): void {
  openPopup(POPUP_PAGE).then((opened) => {
    if (!opened) {
      ext.windows.create({ url: ext.runtime.getURL(POPUP_PAGE), type: 'popup', ...SETTINGS_WINDOW });
    }
  });
}

/** Tells that the picker cannot run in the tab, e.g. on browser pages or extension stores. */
export function showRestrictedNotice(tabId: number): void {
  openPopup(`${POPUP_PAGE}?notice=restricted`).then((opened) => {
    if (!opened) flashBadge(tabId);
  });
}

/** Resolves to false if the browser could not open the popup (Chrome before 127). */
function openPopup(page: string): Promise<boolean> {
  if (typeof ext.action.openPopup !== 'function') return Promise.resolve(false);

  ext.action.setPopup({ popup: page }).catch(() => {});
  return ext.action
    .openPopup()
    .then(
      () => true,
      () => false
    )
    .finally(() => {
      // The open popup keeps its page; the next click starts the picker again.
      ext.action.setPopup({ popup: '' }).catch(() => {});
    });
}

function flashBadge(tabId: number): void {
  const reset = () => ext.action.setBadgeText({ tabId, text: '' }).catch(() => {});

  ext.action.setBadgeBackgroundColor({ tabId, color: '#dc2626' }).catch(() => {});
  ext.action.setBadgeText({ tabId, text: '!' }).catch(() => {});
  setTimeout(reset, BADGE_DURATION);
}
