import { ext } from '../shared/browser';
import { isCaptureRequest, type CaptureResponse } from '../shared/messages';

/** Answers capture requests from the picker with a PNG screenshot of the visible tab. */
export function handleMessage(
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: CaptureResponse) => void
): boolean {
  if (!isCaptureRequest(message)) return false;

  const windowId = sender.tab?.windowId ?? ext.windows.WINDOW_ID_CURRENT;

  ext.tabs
    .captureVisibleTab(windowId, { format: 'png' })
    .then((dataUrl) => sendResponse({ ok: true, dataUrl }))
    .catch((error: unknown) => sendResponse({ ok: false, error: errorMessage(error) }));

  // Keep the channel open for the asynchronous response.
  return true;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
