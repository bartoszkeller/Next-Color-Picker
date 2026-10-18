import { ext } from '../shared/browser';
import { openSettings } from './popup';

const OPEN_SETTINGS = 'open-settings';

/** Adds "Settings" to the toolbar button's context menu. */
export async function installActionMenu(): Promise<void> {
  // Menu items can outlive the background script, so they are recreated
  // instead of added a second time.
  await ext.contextMenus.removeAll();
  ext.contextMenus.create({ id: OPEN_SETTINGS, title: 'Settings', contexts: ['action'] });
}

export function handleMenuClick(info: chrome.contextMenus.OnClickData): void {
  if (info.menuItemId === OPEN_SETTINGS) openSettings();
}
