import { ext } from '../shared/browser';
import type { CaptureResponse } from '../shared/messages';

/** Answers with a PNG screenshot of the visible tab of the sender's window. */
export function captureTab(
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: CaptureResponse) => void
): void {
  const windowId = sender.tab?.windowId ?? ext.windows.WINDOW_ID_CURRENT;

  ext.tabs
    .captureVisibleTab(windowId, { format: 'png' })
    .then((dataUrl) => sendResponse({ ok: true, dataUrl }))
    .catch((error: unknown) => sendResponse({ ok: false, error: errorMessage(error) }));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
