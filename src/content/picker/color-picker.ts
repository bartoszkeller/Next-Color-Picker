import { writeToClipboard } from './clipboard';
import { cycleFormat, DEFAULT_FORMAT, toHex, type ColorFormat, type Rgb } from '../../shared/color-formats';
import {
  DEFAULT_SETTINGS,
  loadInitialFormat,
  loadSettings,
  saveLastFormat,
  type Settings
} from '../../shared/settings';
import { applyTheme } from '../../shared/theme';
import {
  CENTER_INDEX,
  CENTER_OFFSET,
  CONFIRM_DURATION,
  EDGE_MARGIN,
  FADE_DURATION,
  FORMAT_STEP_DELTA,
  FORMAT_STEP_RESET,
  LABEL_GAP,
  LABEL_HEIGHT,
  LENS_SIZE,
  MAX_RETRIES,
  RECAPTURE_DELAY,
  RETRY_DELAY,
  SOURCE_PIXELS,
  SWALLOWED_EVENTS,
  ZOOM
} from './constants';
import { loadFont } from './font';
import { keepIconColor, previewIconColor, resetIconColor } from './icon-color';
import { decodeScreenshot, readPixel, requestScreenshot, type Screenshot } from './screenshot';
import { scrollUnderPointer } from './scrolling';

import { pickerSlot } from './state';
import { renderPicker } from './template';
import { showToast } from './toast';
import { afterFrames, appendToPage, clamp, createOverlayHost } from './utils';

type Binding = [target: EventTarget, type: string, handler: (event: Event) => void];

interface Point {
  x: number;
  y: number;
}

/** Non-passive, so that wheel events can be canceled. */
const LISTENER_OPTIONS: AddEventListenerOptions = { capture: true, passive: false };

/**
 * Full-page overlay with a magnifying lens that follows the cursor.
 *
 * Colors are sampled from a screenshot of the visible tab, drawn to an offscreen
 * canvas. The screenshot is retaken whenever the viewport scrolls or resizes.
 * While the page scrolls, the previous screenshot stays in the lens, shifted by
 * the scrolled distance, and its colors are marked as stale until the new one
 * arrives.
 */
export class ColorPicker {
  // The pointer position is unknown until the first mousemove, which usually
  // arrives when the cursor moves from the toolbar onto the page. Until then
  // the lens stays hidden and nothing is sampled.
  private pointer: Point = { x: Math.round(innerWidth / 2), y: Math.round(innerHeight / 2) };
  private hasPointer = false;
  private color: Rgb | null = null;
  private format: ColorFormat = DEFAULT_FORMAT;
  private settings: Settings = { ...DEFAULT_SETTINGS };
  private formatChanged = false;
  private wheelTotal = 0;
  private lastWheelTime = 0;
  private screenshot: Screenshot | null = null;
  private stale = false;
  private commitPending = false;
  private labelWidth = 0;
  private bindings: Binding[] = [];
  private timer = 0;
  private failures = 0;
  private capturing = false;
  private refreshQueued = false;
  private generation = 0;
  private finished = false;
  /** Screenshot mode only, see onKeyDown. */
  private frozen = false;

  private readonly host: HTMLElement;
  private readonly layer: HTMLElement;
  private readonly lens: HTMLElement;
  private readonly label: HTMLElement;
  private readonly swatch: HTMLElement;
  private readonly valueNode: HTMLElement;
  private readonly badge: HTMLElement;
  private readonly ctx: CanvasRenderingContext2D;

  constructor() {
    const { host, root } = createOverlayHost('inset: 0; display: block; cursor: none');
    const elements = renderPicker(root);

    this.host = host;
    this.layer = elements.layer;
    this.lens = elements.lens;
    this.label = elements.label;
    this.swatch = elements.swatch;
    this.valueNode = elements.value;
    this.badge = elements.badge;
    this.ctx = createLensContext(elements.canvas);

    loadFont();
    applyTheme(this.host, this.settings.theme);
    appendToPage(this.host);
    this.applyFormat(DEFAULT_FORMAT);

    this.applySettings();
    this.listen();
    this.refresh();
  }

  commit(): void {
    // Copy from the screenshot that is on its way, not from the outdated one.
    if (this.stale) {
      this.commitPending = true;
      return;
    }
    if (!this.color) return;

    const value = this.format.format(this.color);
    writeToClipboard(value).then((copied) => {
      if (!copied) showToast(`Could not copy ${value} to the clipboard`, true, this.settings.theme);
    });
    keepIconColor(toHex(this.color));
    this.finish(true);
  }

  cancel(): void {
    this.finish(false);
  }

  /** Usually resolves long before the first screenshot, while the lens is still hidden. */
  private async applySettings(): Promise<void> {
    const settings = await loadSettings();
    const format = await loadInitialFormat(settings);
    if (this.finished) return;

    this.settings = settings;
    applyTheme(this.host, settings.theme);
    if (!this.formatChanged) this.applyFormat(format);
  }

  // Events

  private listen(): void {
    const bindings: Binding[] = SWALLOWED_EVENTS.map((type) => [this.layer, type, stopPropagation]);

    bindings.push(
      [this.layer, 'mousemove', (event) => this.track(event as MouseEvent)],
      [this.layer, 'mouseleave', () => !__SCREENSHOT_MODE__ && this.setPointerInside(false)],
      [this.layer, 'mousedown', (event) => event.preventDefault()],
      [this.layer, 'wheel', (event) => this.onWheel(event as WheelEvent)],
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
      [window, 'scroll', () => this.onScroll()],
      [window, 'resize', () => this.onResize()],
      // Screenshot tools take the focus, so in screenshot mode the picker stays open.
      [window, 'blur', () => !__SCREENSHOT_MODE__ && this.cancel()],
      // Leaving the page would otherwise keep the previewed color in the toolbar icon.
      [window, 'pagehide', () => this.cancel()]
    );

    for (const [target, type, handler] of bindings) {
      target.addEventListener(type, handler, LISTENER_OPTIONS);
    }
    this.bindings = bindings;
  }

  private unlisten(): void {
    for (const [target, type, handler] of this.bindings) {
      target.removeEventListener(type, handler, LISTENER_OPTIONS);
    }
    this.bindings = [];
  }

  private onKeyDown(event: KeyboardEvent): void {
    // Screenshot mode: F freezes the lens, so the cursor of a screenshot tool does not move it.
    if (__SCREENSHOT_MODE__ && event.key.toLowerCase() === 'f') {
      event.preventDefault();
      event.stopPropagation();
      this.frozen = !this.frozen;
      return;
    }

    if (event.key !== 'Escape' && event.key !== 'Enter' && event.key !== ' ') return;

    event.preventDefault();
    event.stopPropagation();

    if (event.key === 'Escape') {
      this.cancel();
    } else {
      this.commit();
    }
  }

  /** Ctrl + wheel switches the color format; a plain wheel scrolls the page. */
  private onWheel(event: WheelEvent): void {
    if (!event.ctrlKey) {
      scrollUnderPointer(event, this.host);
      return;
    }

    // Also keeps the browser from zooming the page.
    event.preventDefault();

    const delta = event.deltaY || event.deltaX;
    if (!delta) return;

    // Mice that report lines or pages scroll in clear notches, one step each.
    if (event.deltaMode !== WheelEvent.DOM_DELTA_PIXEL) {
      this.switchFormat(Math.sign(delta));
      return;
    }

    if (event.timeStamp - this.lastWheelTime > FORMAT_STEP_RESET) this.wheelTotal = 0;
    this.lastWheelTime = event.timeStamp;
    this.wheelTotal += delta;

    if (Math.abs(this.wheelTotal) >= FORMAT_STEP_DELTA) {
      this.switchFormat(Math.sign(this.wheelTotal));
      this.wheelTotal = 0;
    }
  }

  private onScroll(): void {
    this.markStale();
    this.scheduleRefresh();
  }

  private onResize(): void {
    this.invalidate();
    this.scheduleRefresh();
  }

  private track(event: MouseEvent): void {
    if (this.frozen) return;

    this.pointer = { x: event.clientX, y: event.clientY };
    this.setPointerInside(true);
    this.draw();
  }

  /** Hides the lens while the cursor is outside the viewport. */
  private setPointerInside(inside: boolean): void {
    this.hasPointer = inside;
    this.layer.classList.toggle('has-pointer', inside);
  }

  // Color formats

  /** Moves to the next (1) or previous (-1) format and remembers it. */
  private switchFormat(direction: number): void {
    this.formatChanged = true;
    this.applyFormat(cycleFormat(this.format, direction));
    saveLastFormat(this.format);
  }

  private applyFormat(format: ColorFormat): void {
    this.format = format;
    this.badge.textContent = format.name;
    this.renderValue();
    this.measureLabel();
    this.place();
  }

  // Screenshots

  private scheduleRefresh(): void {
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.refresh(), RECAPTURE_DELAY);
  }

  /**
   * Keeps the lens on screen with the previous screenshot after a scroll, but
   * marks its colors as stale, so that an outdated color cannot be copied.
   */
  private markStale(): void {
    if (!this.screenshot) return;

    // Discards a capture that may have been taken mid-scroll.
    this.generation++;
    this.stale = true;
    this.layer.classList.add('is-stale');
    this.draw();
  }

  /** Hides the lens until a new screenshot arrives, so an outdated color cannot be copied. */
  private invalidate(): void {
    this.generation++;
    this.screenshot = null;
    this.stale = false;
    this.layer.classList.remove('is-ready', 'is-stale');
    this.setColor(null);
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
    this.stale = false;
    this.failures = 0;
    this.layer.classList.remove('is-stale');
    this.layer.classList.add('is-ready');
    this.draw();

    if (this.commitPending) {
      this.commitPending = false;
      this.commit();
    }
  }

  /** Resolves to the decoded screenshot, or null on failure. */
  private async capture(): Promise<Screenshot | null> {
    // Hide the lens and label but keep the transparent layer in place, so it
    // continues to block pointer events while staying out of the screenshot.
    this.layer.classList.add('is-capturing');
    await afterFrames(2);

    const scroll = { x: scrollX, y: scrollY };
    const response = this.finished ? null : await requestScreenshot();
    this.layer.classList.remove('is-capturing');
    if (!response?.ok) return null;

    return decodeScreenshot(response.dataUrl, scroll).catch(() => null);
  }

  private retry(): void {
    clearTimeout(this.timer);

    if (++this.failures > MAX_RETRIES) {
      this.cancel();
      showToast('Could not capture this page', true, this.settings.theme);
      return;
    }
    this.timer = window.setTimeout(() => this.refresh(), RETRY_DELAY);
  }

  // Drawing

  private draw(): void {
    this.place();
    const shot = this.screenshot;
    if (!shot || !this.hasPointer) return;

    // The scroll offsets are zero unless the page has scrolled since the capture.
    const x = Math.floor((this.pointer.x + scrollX - shot.scrollX) * shot.scale);
    const y = Math.floor((this.pointer.y + scrollY - shot.scrollY) * shot.scale);

    this.ctx.fillStyle = '#f4f4f5';
    this.ctx.fillRect(0, 0, LENS_SIZE, LENS_SIZE);
    this.drawZoom(shot, x, y);
    this.drawGrid();
    this.drawCenterMarker();
    this.setColor(readPixel(shot, x, y));
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

  private setColor(color: Rgb | null): void {
    this.color = color;
    this.renderValue();
    if (color) previewIconColor(toHex(color));
  }

  /** Shows the current color in the current format. */
  private renderValue(): void {
    const text = this.color ? this.format.format(this.color) : this.format.placeholder;
    const previous = this.valueNode.textContent ?? '';
    if (previous !== text) {
      this.valueNode.textContent = text;

      // The label fits its content. The value is monospaced, so its width
      // only changes with its length, e.g. from rgb(9, 9, 9) to rgb(10, 9, 9).
      if (previous.length !== text.length) {
        this.measureLabel();
        this.place();
      }
    }

    // Without a color, the swatch keeps showing the last one.
    if (this.color) this.swatch.style.background = toHex(this.color);
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
      resetIconColor();
      this.host.remove();
      return;
    }

    // Show the confirmation in the label, then fade out the overlay.
    this.host.style.pointerEvents = 'none';
    this.layer.classList.add('is-copied');
    this.valueNode.textContent = 'Copied';
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
