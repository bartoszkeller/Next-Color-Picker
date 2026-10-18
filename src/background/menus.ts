import { ext } from '../shared/browser';

const OPEN_SETTINGS = 'open-settings';

/**
 * Adds "Settings" to the toolbar button's context menu.
 *
 * Chrome lists the options page there by itself, so only the Firefox manifest
 * requests the menus permission; without it the API is missing and nothing is
 * added.
 */
export async function installActionMenu(): Promise<void> {
  const menus = ext.contextMenus;
  if (!menus) return;

  // Menu items can outlive the background script, so they are recreated
  // instead of added a second time.
  await menus.removeAll();
  menus.create({ id: OPEN_SETTINGS, title: 'Settings', contexts: ['action'] });
}

export function handleMenuClick(info: chrome.contextMenus.OnClickData): void {
  if (info.menuItemId === OPEN_SETTINGS) ext.runtime.openOptionsPage();
}
