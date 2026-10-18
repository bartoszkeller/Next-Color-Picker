/** Messages sent to the background script by the picker and the offscreen document. */

export const MessageType = {
  Capture: 'capture',
  PreviewColor: 'preview-color',
  CopyColor: 'copy-color',
  ColorScheme: 'color-scheme'
} as const;

/** Asks for a screenshot of the visible tab; answered with a CaptureResponse. */
export interface CaptureRequest {
  type: typeof MessageType.Capture;
}

export type CaptureResponse = { ok: true; dataUrl: string } | { ok: false; error: string };

/** Shows the color under the cursor in the toolbar icon; null restores the copied one. */
export interface PreviewColorMessage {
  type: typeof MessageType.PreviewColor;
  color: string | null;
}

/** Keeps the copied color in the toolbar icon until the next copy. */
export interface CopyColorMessage {
  type: typeof MessageType.CopyColor;
  color: string;
}

/** Reports the browser's color scheme, which the toolbar icon adapts to. */
export interface ColorSchemeMessage {
  type: typeof MessageType.ColorScheme;
  scheme: ColorScheme;
}

export type ColorScheme = 'light' | 'dark';

export type Message = CaptureRequest | PreviewColorMessage | CopyColorMessage | ColorSchemeMessage;

const TYPES: readonly string[] = Object.values(MessageType);

export function isMessage(value: unknown): value is Message {
  return TYPES.includes((value as Partial<Message> | undefined)?.type as string);
}
