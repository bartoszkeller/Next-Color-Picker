/*
 * Background script: a service worker in Chrome, an event page in Firefox.
 *
 * - Injects the picker into the active tab when the toolbar button is clicked.
 * - Captures the visible tab on request from the picker.
 * - In Chrome, shows the colored toolbar icon only on web and file pages.
 *
 * Injection and capture rely on the activeTab grant, so no host permissions
 * are required.
 *
 * Listeners are registered synchronously at the top level, so that the browser
 * can wake the script up for them after it has been suspended.
 */
import { ext } from '../shared/browser';
import { handleMessage } from './capture';
import { injectPicker } from './injection';
import { installPageRules } from './page-rules';

ext.runtime.onInstalled.addListener(async () => {
  // Clears the disabled state left by earlier versions.
  ext.action.enable();

  await installPageRules();
});

ext.action.onClicked.addListener(injectPicker);

ext.runtime.onMessage.addListener(handleMessage);
