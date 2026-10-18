/*
 * Background script: a service worker in Chrome, an event page in Firefox.
 *
 * - Injects the picker into the active tab when the toolbar button is clicked,
 *   or shows a notice where it cannot run.
 * - Captures the visible tab on request from the picker.
 * - Draws the toolbar icon in the color under the cursor or copied last.
 * - Adds "Settings" to the toolbar button's context menu, opening the popup.
 *
 * Injection and capture rely on the activeTab grant, so no host permissions
 * are required.
 *
 * Listeners are registered synchronously at the top level, so that the browser
 * can wake the script up for them after it has been suspended.
 */
import { ext } from '../shared/browser';
import { watchColorScheme } from './color-scheme';
import { injectPicker } from './injection';
import { handleMenuClick, installActionMenu } from './menus';
import { handleMessage } from './messages';
import { forgetPreviewOfTab, updateToolbarIcon } from './toolbar-icon';

ext.runtime.onInstalled.addListener(async () => {
  // Clears the disabled state left by earlier versions.
  ext.action.enable();

  await Promise.all([installActionMenu(), updateToolbarIcon()]);
});

ext.runtime.onStartup.addListener(async () => {
  // The icon drawn at runtime is not kept across browser restarts, and in
  // Firefox neither are the menu items of an event page.
  await Promise.all([installActionMenu(), updateToolbarIcon()]);
});

ext.action.onClicked.addListener(injectPicker);
ext.contextMenus.onClicked.addListener(handleMenuClick);
ext.runtime.onMessage.addListener(handleMessage);
ext.tabs.onRemoved.addListener(forgetPreviewOfTab);

watchColorScheme();
