import { ext } from '../../shared/browser';
import { MessageType, type CaptureRequest, type CaptureResponse } from '../../shared/messages';
import type { Rgb } from './color-formats';

export interface Screenshot {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  /** Device pixels per CSS pixel. */
  scale: number;
  /** Document scroll position at the time of the capture, in CSS pixels. */
  scrollX: number;
  scrollY: number;
}

/** Asks the background script to capture the visible tab. Never rejects. */
export async function requestScreenshot(): Promise<CaptureResponse> {
  const request: CaptureRequest = { type: MessageType.Capture };

  try {
    const response = (await ext.runtime.sendMessage(request)) as CaptureResponse | undefined;
    return response ?? { ok: false, error: 'no response' };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Draws the screenshot to a canvas so that its pixels can be read. */
export function decodeScreenshot(dataUrl: string, scroll: { x: number; y: number }): Promise<Screenshot> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.addEventListener('load', () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;

      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(image, 0, 0);

      resolve({
        canvas,
        ctx,
        width: image.width,
        height: image.height,
        // Screenshots are in device pixels, pointer coordinates in CSS pixels.
        scale: image.width / innerWidth,
        scrollX: scroll.x,
        scrollY: scroll.y
      });
    });
    image.addEventListener('error', () => reject(new Error('cannot decode screenshot')));
    image.src = dataUrl;
  });
}

/** Reads one pixel, in screenshot coordinates; null outside of the screenshot. */
export function readPixel({ ctx, width, height }: Screenshot, x: number, y: number): Rgb | null {
  if (x < 0 || y < 0 || x >= width || y >= height) return null;

  const [r = 0, g = 0, b = 0] = ctx.getImageData(x, y, 1, 1).data;
  return { r, g, b };
}
