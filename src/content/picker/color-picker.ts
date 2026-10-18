import { writeToClipboard } from './clipboard';
import {
  CENTER_INDEX,
  CENTER_OFFSET,
  CONFIRM_DURATION,
  EDGE_MARGIN,
  FADE_DURATION,
  LABEL_GAP,
  LABEL_HEIGHT,
  LENS_SIZE,
  MAX_RETRIES,
  NO_COLOR,
  RECAPTURE_DELAY,
  RETRY_DELAY,
  SOURCE_PIXELS,
  SWALLOWED_EVENTS,
  ZOOM
} from './constants';
import { decodeScreenshot, requestScreenshot, type Screenshot } from './screenshot';
import { pickerSlot } from './state';
import { renderPicker } from './template';
import { showToast } from './toast';
import { afterFrames, appendToPage, clamp, createOverlayHost, toHex } from './utils';

type Binding = [target: EventTarget, type: string, handler: (event: Event) => void];

interface Point {
  x: number;
  y: number;
}

/**
 * Full-page overlay with a magnifying lens that follows the cursor.
 *
 * Colors are sampled from a screenshot of the visible tab, drawn to an offscreen
 * canvas. The screenshot is retaken whenever the viewport scrolls or resizes.
 */
export class ColorPicker {
  // The pointer position is unknown until the first mousemove, which usually
  // arrives when the cursor moves from the toolbar onto the page. Until then
  // the lens stays hidden and nothing is sampled.
  private pointer: Point = { x: Math.round(innerWidth / 2), y: Math.round(innerHeight / 2) };
  private hasPointer = false;
  private hex = NO_COLOR;
  private screenshot: Screenshot | null = null;
  private labelWidth = 0;
  private bindings: Binding[] = [];
  private timer = 0;
  private failures = 0;
  private capturing = false;
  private refreshQueued = false;
  private generation = 0;
  private finished = false;

  private readonly host: HTMLElement;
  private readonly layer: HTMLElement;
  private readonly lens: HTMLElement;
  private readonly label: HTMLElement;
  private readonly swatch: HTMLElement;
  private readonly hexNode: HTMLElement;
  private readonly ctx: CanvasRenderingContext2D;

  constructor() {
    const { host, root } = createOverlayHost('inset: 0; display: block; cursor: none');
    const elements = renderPicker(root);

    this.host = host;
    this.layer = elements.layer;
    this.lens = elements.lens;
    this.label = elements.label;
    this.swatch = elements.swatch;
    this.hexNode = elements.hex;
    this.ctx = createLensContext(elements.canvas);

    appendToPage(this.host);
    this.measureLabel();
    this.place();

    this.listen();
    this.refresh();
  }

  commit(): void {
    if (this.hex === NO_COLOR) return;

    const hex = this.hex;
    writeToClipboard(hex).then((copied) => {
      if (!copied) showToast(`Could not copy ${hex} to the clipboard`, true);
    });
    this.finish(true);
  }

  cancel(): void {
    this.finish(false);
  }

  // Events

  private listen(): void {
    const bindings: Binding[] = SWALLOWED_EVENTS.map((type) => [this.layer, type, stopPropagation]);

    bindings.push(
      [this.layer, 'mousemove', (event) => this.track(event as MouseEvent)],
      [this.layer, 'mouseleave', () => this.setPointerInside(false)],
      [this.layer, 'mousedown', (event) => event.preventDefault()],
      [
        this.layer,
        'click',
        (event) => {
          event.preventDefault();
          this.commit();
        }
      ],
      [
        this.layer,
        'contextmenu',
        (event) => {
          event.preventDefault();
          this.cancel();
        }
      ],
      [window, 'keydown', (event) => this.onKeyDown(event as KeyboardEvent)],
      [window, 'scroll', () => this.scheduleRefresh()],
      [window, 'resize', () => this.scheduleRefresh()],
      [window, 'blur', () => this.cancel()]
    );

    for (const [target, type, handler] of bindings) {
      target.addEventListener(type, handler, true);
    }
    this.bindings = bindings;
  }

  private unlisten(): void {
    for (const [target, type, handler] of this.bindings) {
      target.removeEventListener(type, handler, true);
    }
    this.bindings = [];
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (event.key !== 'Escape' && event.key !== 'Enter' && event.key !== ' ') return;

    event.preventDefault();
    event.stopPropagation();

    if (event.key === 'Escape') {
      this.cancel();
    } else {
      this.commit();
    }
  }

  private track(event: MouseEvent): void {
    this.pointer = { x: event.clientX, y: event.clientY };
    this.setPointerInside(true);
    this.draw();
  }

  /** Hides the lens while the cursor is outside the viewport. */
  private setPointerInside(inside: boolean): void {
    this.hasPointer = inside;
    this.layer.classList.toggle('has-pointer', inside);
  }

  // Screenshots

  private scheduleRefresh(): void {
    this.invalidate();
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.refresh(), RECAPTURE_DELAY);
  }

  /** Hides the lens until a new screenshot arrives, so an outdated color cannot be copied. */
  private invalidate(): void {
    this.generation++;
    this.screenshot = null;
    this.layer.classList.remove('is-ready');
    this.setColor(NO_COLOR);
  }

  /** Captures the viewport and redraws the lens. */
  private async refresh(): Promise<void> {
    if (this.finished) return;

    // Run one capture at a time. An overlapping capture could remove the
    // is-capturing class too early and include the lens in the screenshot.
    if (this.capturing) {
      this.refreshQueued = true;
      return;
    }

    const generation = this.generation;
    this.capturing = true;
    const screenshot = await this.capture();
    this.capturing = false;
    if (this.finished) return;

    if (this.refreshQueued) {
      this.refreshQueued = false;
      this.refresh();
      return;
    }

    // The viewport changed during the capture and a new refresh is already
    // scheduled, so this result is outdated.
    if (generation !== this.generation) return;

    if (!screenshot) {
      this.retry();
      return;
    }

    this.screenshot = screenshot;
    this.failures = 0;
    this.layer.classList.add('is-ready');
    this.draw();
  }

  /** Resolves to the decoded screenshot, or null on failure. */
  private async capture(): Promise<Screenshot | null> {
    // Hide the lens and label but keep the transparent layer in place, so it
    // continues to block pointer events while staying out of the screenshot.
    this.layer.classList.add('is-capturing');
    await afterFrames(2);

    const response = this.finished ? null : await requestScreenshot();
    this.layer.classList.remove('is-capturing');
    if (!response?.ok) return null;

    return decodeScreenshot(response.dataUrl).catch(() => null);
  }

  private retry(): void {
    clearTimeout(this.timer);

    if (++this.failures > MAX_RETRIES) {
      this.cancel();
      showToast('Could not capture this page', true);
      return;
    }
    this.timer = window.setTimeout(() => this.refresh(), RETRY_DELAY);
  }

  // Drawing

  private draw(): void {
    this.place();
    if (!this.screenshot || !this.hasPointer) return;

    const x = Math.floor(this.pointer.x * this.screenshot.scale);
    const y = Math.floor(this.pointer.y * this.screenshot.scale);

    this.ctx.fillStyle = '#f4f4f5';
    this.ctx.fillRect(0, 0, LENS_SIZE, LENS_SIZE);
    this.drawZoom(this.screenshot, x, y);
    this.drawGrid();
    this.drawCenterMarker();
    this.setColor(sample(this.screenshot, x, y));
  }

  private drawZoom({ canvas, width, height }: Screenshot, centerX: number, centerY: number): void {
    let sx = centerX - CENTER_INDEX;
    let sy = centerY - CENTER_INDEX;
    let sw = SOURCE_PIXELS;
    let sh = SOURCE_PIXELS;
    let dx = 0;
    let dy = 0;

    // Clip the source rectangle manually. drawImage scales an out-of-bounds
    // source instead of cropping it, which would shift the center pixel near
    // the edges of the viewport.
    if (sx < 0) {
      dx = -sx * ZOOM;
      sw += sx;
      sx = 0;
    }
    if (sy < 0) {
      dy = -sy * ZOOM;
      sh += sy;
      sy = 0;
    }
    sw = Math.min(sw, width - sx);
    sh = Math.min(sh, height - sy);
    if (sw <= 0 || sh <= 0) return;

    this.ctx.drawImage(canvas, sx, sy, sw, sh, dx, dy, sw * ZOOM, sh * ZOOM);
  }

  private drawGrid(): void {
    const ctx = this.ctx;

    ctx.strokeStyle = 'rgba(0, 0, 0, .10)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < SOURCE_PIXELS; i++) {
      const offset = i * ZOOM + 0.5;
      ctx.moveTo(offset, 0);
      ctx.lineTo(offset, LENS_SIZE);
      ctx.moveTo(0, offset);
      ctx.lineTo(LENS_SIZE, offset);
    }
    ctx.stroke();
  }

  private drawCenterMarker(): void {
    const ctx = this.ctx;

    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(0, 0, 0, .7)';
    ctx.strokeRect(CENTER_OFFSET - 1, CENTER_OFFSET - 1, ZOOM + 2, ZOOM + 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, .95)';
    ctx.strokeRect(CENTER_OFFSET + 0.5, CENTER_OFFSET + 0.5, ZOOM - 1, ZOOM - 1);
  }

  private setColor(hex: string): void {
    if (hex === this.hex) return;

    this.hex = hex;
    this.hexNode.textContent = hex;
    this.swatch.style.background = hex;
  }

  /** Centers the lens on the pointer; the label goes below it, or above near the bottom edge. */
  private place(): void {
    const { x, y } = this.pointer;
    const radius = LENS_SIZE / 2;
    const below = y + radius + LABEL_GAP;
    const top = below + LABEL_HEIGHT <= innerHeight ? below : y - radius - LABEL_GAP - LABEL_HEIGHT;
    const left = clamp(x - this.labelWidth / 2, EDGE_MARGIN, innerWidth - this.labelWidth - EDGE_MARGIN);

    this.lens.style.transform = `translate(${x - radius}px, ${y - radius}px)`;
    this.label.style.transform = `translate(${left}px, ${top}px)`;
  }

  private measureLabel(): void {
    this.labelWidth = this.label.offsetWidth;
  }

  // Teardown

  private finish(copied: boolean): void {
    if (this.finished) return;
    this.finished = true;

    clearTimeout(this.timer);
    this.unlisten();
    pickerSlot.release(this);

    if (!copied) {
      this.host.remove();
      return;
    }

    // Show the confirmation in the label, then fade out the overlay.
    this.host.style.pointerEvents = 'none';
    this.hexNode.textContent = 'copied';
    this.measureLabel();
    this.place();

    this.timer = window.setTimeout(() => {
      this.layer.classList.add('is-fading');
      setTimeout(() => this.host.remove(), FADE_DURATION);
    }, CONFIRM_DURATION);
  }
}

function stopPropagation(event: Event): void {
  event.stopPropagation();
}

/** Sizes the lens canvas for sharp rendering on high-density displays. */
function createLensContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ratio = clamp(devicePixelRatio || 1, 1, 3);
  canvas.width = LENS_SIZE * ratio;
  canvas.height = LENS_SIZE * ratio;

  const ctx = canvas.getContext('2d')!;
  ctx.scale(ratio, ratio);
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

function sample({ ctx, width, height }: Screenshot, x: number, y: number): string {
  const [r = 0, g = 0, b = 0] = ctx.getImageData(clamp(x, 0, width - 1), clamp(y, 0, height - 1), 1, 1).data;

  return toHex(r, g, b);
}
