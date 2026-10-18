import { isMessage, MessageType, type CaptureResponse } from '../shared/messages';
import { captureTab } from './capture';
import { keepColorInIcon, previewColorInIcon, setToolbarScheme } from './toolbar-icon';

/** Handles messages from the picker and the offscreen document. */
export function handleMessage(
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: CaptureResponse) => void
): boolean {
  if (!isMessage(message)) return false;

  switch (message.type) {
    case MessageType.Capture:
      captureTab(sender, sendResponse);
      // Keep the channel open for the asynchronous response.
      return true;
    case MessageType.PreviewColor:
      previewColorInIcon(message.color, sender.tab?.id);
      return false;
    case MessageType.CopyColor:
      keepColorInIcon(message.color);
      return false;
    case MessageType.ColorScheme:
      setToolbarScheme(message.scheme);
      return false;
  }
}
