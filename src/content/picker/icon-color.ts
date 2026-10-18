/**
 * Shows the color under the cursor in the toolbar icon, see
 * src/background/toolbar-icon.ts.
 */
import { ext } from '../../shared/browser';
import { MessageType, type Message } from '../../shared/messages';
import { ICON_PREVIEW_INTERVAL } from './constants';

let pending: string | null = null;
let sent: string | null = null;
let timer = 0;

/** Previews a color, at most once per ICON_PREVIEW_INTERVAL. */
export function previewIconColor(hex: string): void {
  pending = hex;
  if (!timer) timer = window.setTimeout(flush, ICON_PREVIEW_INTERVAL);
}

/** Keeps the copied color in the icon. */
export function keepIconColor(hex: string): void {
  stop();
  send({ type: MessageType.CopyColor, color: hex });
}

/** Restores the icon to the color copied last, if anything was previewed. */
export function resetIconColor(): void {
  stop();
  if (sent) send({ type: MessageType.PreviewColor, color: null });
}

function flush(): void {
  timer = 0;
  if (pending === sent) return;

  sent = pending;
  send({ type: MessageType.PreviewColor, color: pending });
}

function stop(): void {
  clearTimeout(timer);
  timer = 0;
}

function send(message: Message): void {
  // Fails only while the extension is reloaded; the icon then resets anyway.
  ext.runtime.sendMessage(message).catch(() => {});
}
