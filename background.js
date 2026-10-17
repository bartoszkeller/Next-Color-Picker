'use strict';

/*
 * Service worker.
 *
 * - Injects the picker into the active tab when the toolbar button is clicked.
 * - Captures the visible tab on request from the picker.
 * - Shows the colored toolbar icon only on web and file pages.
 *
 * Injection and capture rely on the activeTab grant, so no host permissions
 * are required.
 */

const ICON_SIZES = [16, 32, 48, 128];
const DEFAULT_ICON = buildIconSet('icons/icon$.png');
const BLOCKED_ICON = buildIconSet('icons/icon$-blocked.png');

// How long the blocked icon is shown after a failed injection, in ms.
const FAILURE_FEEDBACK = 1500;

// Icon sizes passed to the declarative rule; the toolbar only uses these two.
const RULE_ICON_SIZES = [16, 32];

// The manifest sets the grey icon as the default and a declarative rule swaps
// in the colored one on supported pages. This avoids reading tab URLs, and the
// button stays enabled: Chrome opens the extension menu when a disabled button
// is clicked.
chrome.runtime.onInstalled.addListener(async () => {
  // Clears the disabled state left by earlier versions.
  chrome.action.enable();

  const imageData = await loadIconImageData(DEFAULT_ICON);

  chrome.declarativeContent.onPageChanged.removeRules(undefined, () => {
    chrome.declarativeContent.onPageChanged.addRules([{
      conditions: [
        new chrome.declarativeContent.PageStateMatcher({
          pageUrl: { schemes: ['http', 'https', 'file'] }
        })
      ],
      actions: [new chrome.declarativeContent.SetIcon({ imageData })]
    }]);
  });
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;

  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['picker.js'] });
  } catch {
    // Internal pages already show the grey icon, so the click is ignored there.
    // Some web pages reject injection as well, e.g. the extension stores, the
    // built-in PDF viewer, or file URLs without file access granted; there the
    // icon turns grey briefly.
    if (!isSupported(tab.url)) return;

    setIcon(tab.id, BLOCKED_ICON);
    setTimeout(() => setIcon(tab.id, DEFAULT_ICON), FAILURE_FEEDBACK);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'capture') return false;

  const windowId = sender.tab?.windowId ?? chrome.windows.WINDOW_ID_CURRENT;

  chrome.tabs.captureVisibleTab(windowId, { format: 'png' })
    .then((dataUrl) => sendResponse({ ok: true, dataUrl }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));

  // Keep the channel open for the asynchronous response.
  return true;
});

function setIcon(tabId, path) {
  // Rejects if the tab has been closed; that case is safe to ignore.
  chrome.action.setIcon({ tabId, path }).catch(() => {});
}

// The URL is only readable after a click, through the activeTab grant.
function isSupported(url) {
  return /^(https?|file):/i.test(url ?? '');
}

// declarativeContent.SetIcon accepts only ImageData, not file paths.
async function loadIconImageData(iconSet) {
  const entries = await Promise.all(RULE_ICON_SIZES.map(async (size) => {
    const response = await fetch(chrome.runtime.getURL(iconSet[size]));
    const bitmap = await createImageBitmap(await response.blob());
    const ctx = new OffscreenCanvas(size, size).getContext('2d');
    ctx.drawImage(bitmap, 0, 0, size, size);
    return [size, ctx.getImageData(0, 0, size, size)];
  }));

  return Object.fromEntries(entries);
}

function buildIconSet(template) {
  return Object.fromEntries(ICON_SIZES.map((size) => [size, template.replace('$', size)]));
}
