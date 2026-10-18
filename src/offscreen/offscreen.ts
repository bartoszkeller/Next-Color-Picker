/*
 * Offscreen document (Chrome only), see src/background/color-scheme.ts.
 * Reports the browser's color scheme now and whenever it changes.
 */
import { ext } from '../shared/browser';
import { MessageType, type ColorSchemeMessage } from '../shared/messages';

const query = matchMedia('(prefers-color-scheme: dark)');

function report(): void {
  const message: ColorSchemeMessage = {
    type: MessageType.ColorScheme,
    scheme: query.matches ? 'dark' : 'light'
  };
  ext.runtime.sendMessage(message).catch(() => {});
}

report();
query.addEventListener('change', report);
