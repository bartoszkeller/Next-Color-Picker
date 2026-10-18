/** Messages exchanged between the picker (content script) and the background script. */

export const MessageType = {
  Capture: 'capture'
} as const;

/** Asks the background script for a screenshot of the visible tab. */
export interface CaptureRequest {
  type: typeof MessageType.Capture;
}

export type CaptureResponse = { ok: true; dataUrl: string } | { ok: false; error: string };

export function isCaptureRequest(message: unknown): message is CaptureRequest {
  return (message as Partial<CaptureRequest> | undefined)?.type === MessageType.Capture;
}
