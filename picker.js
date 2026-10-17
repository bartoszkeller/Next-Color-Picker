'use strict';

/*
 * Picker overlay, injected into the active tab by background.js.
 *
 * Colors are sampled from a screenshot of the visible tab, drawn to an offscreen
 * canvas. The screenshot is retaken whenever the viewport scrolls or resizes.
 */
(() => {
  const INSTANCE_KEY = '__nextColorPickerInstance';
  const TOAST_KEY = '__nextColorPickerToast';

  // Injecting while the picker is open closes it, so the toolbar button acts as a toggle.
  if (window[INSTANCE_KEY]) {
    window[INSTANCE_KEY].cancel();
    return;
  }

  // Must be odd so that a single pixel sits in the center of the lens.
  const SOURCE_PIXELS = 15;
  const ZOOM = 11;
  const LENS_SIZE = SOURCE_PIXELS * ZOOM;
  const CENTER_INDEX = (SOURCE_PIXELS - 1) / 2;
  const CENTER_OFFSET = CENTER_INDEX * ZOOM;

  // chrome.tabs.captureVisibleTab is rate-limited to about two calls per second.
  const RECAPTURE_DELAY = 260;
  const RETRY_DELAY = 500;
  const MAX_RETRIES = 4;

  const CONFIRM_DURATION = 520;
  const FADE_DURATION = 200;
  const LABEL_HEIGHT = 26;
  const LABEL_GAP = 10;
  const EDGE_MARGIN = 6;
  const NO_COLOR = '#------';

  const TOAST_DURATION = 3000;

  // Stopped at the overlay so that page-level listeners (hover menus, tooltips,
  // canvas apps) do not react while the picker is open.
  const SWALLOWED_EVENTS = [
    'mousemove', 'mouseover', 'mouseout', 'mouseenter', 'mouseleave',
    'mousedown', 'mouseup', 'click', 'dblclick', 'auxclick', 'contextmenu',
    'pointermove', 'pointerover', 'pointerout', 'pointerenter', 'pointerleave',
    'pointerdown', 'pointerup', 'touchstart', 'touchmove', 'touchend', 'dragstart'
  ];

  const TEMPLATE = `
    <style>
      :host, * { box-sizing: border-box; }

      .layer {
        position: fixed;
        inset: 0;
        cursor: none;
      }

      .lens, .label {
        position: fixed;
        top: 0;
        left: 0;
        pointer-events: none;
        opacity: 0;
        transition: opacity .12s ease;
        will-change: transform;
      }

      .lens {
        width: ${LENS_SIZE}px;
        height: ${LENS_SIZE}px;
        border-radius: 50%;
        overflow: hidden;
        box-shadow:
          0 0 0 3px rgba(255, 255, 255, .95),
          0 0 0 4px rgba(0, 0, 0, .28),
          0 10px 28px rgba(0, 0, 0, .32);
      }

      .lens canvas {
        display: block;
        width: ${LENS_SIZE}px;
        height: ${LENS_SIZE}px;
        border-radius: 50%;
      }

      .label {
        display: flex;
        align-items: center;
        gap: 7px;
        height: ${LABEL_HEIGHT}px;
        padding: 0 10px;
        border-radius: ${LABEL_HEIGHT / 2}px;
        background: rgba(255, 255, 255, .97);
        color: #18181b;
        font: 600 12.5px/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        letter-spacing: .04em;
        white-space: nowrap;
        box-shadow:
          0 0 0 1px rgba(0, 0, 0, .28),
          0 8px 22px rgba(0, 0, 0, .28);
      }

      .swatch {
        width: 12px;
        height: 12px;
        border-radius: 3px;
        background: #000;
        box-shadow: inset 0 0 0 1px rgba(0, 0, 0, .28);
      }

      .is-ready.has-pointer .lens, .is-ready.has-pointer .label { opacity: 1; }
      .is-capturing .lens, .is-capturing .label { visibility: hidden; }

      .is-fading .lens, .is-fading .label {
        opacity: 0;
        transition: opacity .16s ease;
      }
    </style>
    <div class="layer">
      <div class="lens"><canvas></canvas></div>
      <div class="label"><span class="swatch"></span><span class="hex">${NO_COLOR}</span></div>
    </div>
  `;

  class ColorPicker {
    constructor() {
      // The pointer position is unknown until the first mousemove, which usually
      // arrives when the cursor moves from the toolbar onto the page. Until then
      // the lens stays hidden and nothing is sampled.
      this.pointer = { x: Math.round(innerWidth / 2), y: Math.round(innerHeight / 2) };
      this.hasPointer = false;
      this.hex = NO_COLOR;
      this.screenshot = null;
      this.labelWidth = 0;
      this.bindings = [];
      this.timer = 0;
      this.failures = 0;
      this.capturing = false;
      this.refreshQueued = false;
      this.generation = 0;
      this.finished = false;

      this.mount();
      this.listen();
      this.refresh();
    }

    mount() {
      this.host = document.createElement('div');
      this.host.style.cssText =
        'all: initial; position: fixed; inset: 0; z-index: 2147483647; display: block; cursor: none';

      const root = this.host.attachShadow({ mode: 'closed' });
      root.innerHTML = TEMPLATE;

      this.layer = root.querySelector('.layer');
      this.lens = root.querySelector('.lens');
      this.label = root.querySelector('.label');
      this.swatch = root.querySelector('.swatch');
      this.hexNode = root.querySelector('.hex');

      const canvas = root.querySelector('canvas');
      const ratio = Math.min(Math.max(devicePixelRatio || 1, 1), 3);
      canvas.width = LENS_SIZE * ratio;
      canvas.height = LENS_SIZE * ratio;

      this.ctx = canvas.getContext('2d');
      this.ctx.scale(ratio, ratio);
      this.ctx.imageSmoothingEnabled = false;

      (document.documentElement || document.body).appendChild(this.host);
      this.measureLabel();
      this.place();
    }

    listen() {
      const swallow = (event) => event.stopPropagation();
      const bindings = SWALLOWED_EVENTS.map((type) => [this.layer, type, swallow]);

      bindings.push(
        [this.layer, 'mousemove', (event) => this.track(event)],
        [this.layer, 'mouseleave', () => this.setPointerInside(false)],
        [this.layer, 'mousedown', (event) => event.preventDefault()],
        [this.layer, 'click', (event) => { event.preventDefault(); this.commit(); }],
        [this.layer, 'contextmenu', (event) => { event.preventDefault(); this.cancel(); }],
        [window, 'keydown', (event) => this.onKeyDown(event)],
        [window, 'scroll', () => this.scheduleRefresh()],
        [window, 'resize', () => this.scheduleRefresh()],
        [window, 'blur', () => this.cancel()]
      );

      for (const [target, type, handler] of bindings) {
        target.addEventListener(type, handler, true);
      }
      this.bindings = bindings;
    }

    unlisten() {
      for (const [target, type, handler] of this.bindings) {
        target.removeEventListener(type, handler, true);
      }
      this.bindings = [];
    }

    onKeyDown(event) {
      if (event.key !== 'Escape' && event.key !== 'Enter' && event.key !== ' ') return;

      event.preventDefault();
      event.stopPropagation();

      if (event.key === 'Escape') {
        this.cancel();
      } else {
        this.commit();
      }
    }

    track(event) {
      this.pointer = { x: event.clientX, y: event.clientY };
      this.setPointerInside(true);
      this.draw();
    }

    /** Hides the lens while the cursor is outside the viewport. */
    setPointerInside(inside) {
      this.hasPointer = inside;
      this.layer.classList.toggle('has-pointer', inside);
    }

    scheduleRefresh() {
      this.invalidate();
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.refresh(), RECAPTURE_DELAY);
    }

    /** Hides the lens until a new screenshot arrives, so an outdated color cannot be copied. */
    invalidate() {
      this.generation++;
      this.screenshot = null;
      this.layer.classList.remove('is-ready');
      this.setColor(NO_COLOR);
    }

    /** Captures the viewport and redraws the lens. */
    async refresh() {
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
    async capture() {
      // Hide the lens and label but keep the transparent layer in place, so it
      // continues to block pointer events while staying out of the screenshot.
      this.layer.classList.add('is-capturing');
      await afterFrames(2);

      const response = this.finished ? null : await requestScreenshot();
      this.layer.classList.remove('is-capturing');
      if (!response?.ok) return null;

      return decodeScreenshot(response.dataUrl).catch(() => null);
    }

    retry() {
      clearTimeout(this.timer);

      if (++this.failures > MAX_RETRIES) {
        this.cancel();
        showToast('Could not capture this page', true);
        return;
      }
      this.timer = setTimeout(() => this.refresh(), RETRY_DELAY);
    }

    draw() {
      this.place();
      if (!this.screenshot || !this.hasPointer) return;

      const x = Math.floor(this.pointer.x * this.screenshot.scale);
      const y = Math.floor(this.pointer.y * this.screenshot.scale);

      this.ctx.fillStyle = '#f4f4f5';
      this.ctx.fillRect(0, 0, LENS_SIZE, LENS_SIZE);
      this.drawZoom(x, y);
      this.drawGrid();
      this.drawCenterMarker();
      this.setColor(this.sample(x, y));
    }

    drawZoom(centerX, centerY) {
      const { canvas, width, height } = this.screenshot;

      let sx = centerX - CENTER_INDEX;
      let sy = centerY - CENTER_INDEX;
      let sw = SOURCE_PIXELS;
      let sh = SOURCE_PIXELS;
      let dx = 0;
      let dy = 0;

      // Clip the source rectangle manually. drawImage scales an out-of-bounds
      // source instead of cropping it, which would shift the center pixel near
      // the edges of the viewport.
      if (sx < 0) { dx = -sx * ZOOM; sw += sx; sx = 0; }
      if (sy < 0) { dy = -sy * ZOOM; sh += sy; sy = 0; }
      sw = Math.min(sw, width - sx);
      sh = Math.min(sh, height - sy);
      if (sw <= 0 || sh <= 0) return;

      this.ctx.drawImage(canvas, sx, sy, sw, sh, dx, dy, sw * ZOOM, sh * ZOOM);
    }

    drawGrid() {
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

    drawCenterMarker() {
      const ctx = this.ctx;

      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(0, 0, 0, .7)';
      ctx.strokeRect(CENTER_OFFSET - 1, CENTER_OFFSET - 1, ZOOM + 2, ZOOM + 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, .95)';
      ctx.strokeRect(CENTER_OFFSET + 0.5, CENTER_OFFSET + 0.5, ZOOM - 1, ZOOM - 1);
    }

    sample(x, y) {
      const { ctx, width, height } = this.screenshot;
      const [r, g, b] = ctx.getImageData(clamp(x, 0, width - 1), clamp(y, 0, height - 1), 1, 1).data;

      return toHex(r, g, b);
    }

    setColor(hex) {
      if (hex === this.hex) return;

      this.hex = hex;
      this.hexNode.textContent = hex;
      this.swatch.style.background = hex;
    }

    /** Centers the lens on the pointer; the label goes below it, or above near the bottom edge. */
    place() {
      const { x, y } = this.pointer;
      const radius = LENS_SIZE / 2;
      const below = y + radius + LABEL_GAP;
      const top = below + LABEL_HEIGHT <= innerHeight ? below : y - radius - LABEL_GAP - LABEL_HEIGHT;
      const left = clamp(x - this.labelWidth / 2, EDGE_MARGIN, innerWidth - this.labelWidth - EDGE_MARGIN);

      this.lens.style.transform = `translate(${x - radius}px, ${y - radius}px)`;
      this.label.style.transform = `translate(${left}px, ${top}px)`;
    }

    measureLabel() {
      this.labelWidth = this.label.offsetWidth;
    }

    commit() {
      if (this.hex === NO_COLOR) return;

      const hex = this.hex;
      writeToClipboard(hex).then((copied) => {
        if (!copied) showToast(`Could not copy ${hex} to the clipboard`, true);
      });
      this.finish(true);
    }

    cancel() {
      this.finish(false);
    }

    finish(copied) {
      if (this.finished) return;
      this.finished = true;

      clearTimeout(this.timer);
      this.unlisten();
      if (window[INSTANCE_KEY] === this) delete window[INSTANCE_KEY];

      if (!copied) {
        this.host.remove();
        return;
      }

      // Show the confirmation in the label, then fade out the overlay.
      this.host.style.pointerEvents = 'none';
      this.hexNode.textContent = 'copied';
      this.measureLabel();
      this.place();

      this.timer = setTimeout(() => {
        this.layer.classList.add('is-fading');
        setTimeout(() => this.host.remove(), FADE_DURATION);
      }, CONFIRM_DURATION);
    }
  }

  async function requestScreenshot() {
    try {
      return await chrome.runtime.sendMessage({ type: 'capture' }) ?? { ok: false, error: 'no response' };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  function decodeScreenshot(dataUrl) {
    return new Promise((resolve, reject) => {
      const image = new Image();

      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(image, 0, 0);

        resolve({
          canvas,
          ctx,
          width: image.width,
          height: image.height,
          // Screenshots are in device pixels, pointer coordinates in CSS pixels.
          scale: image.width / innerWidth
        });
      };
      image.onerror = () => reject(new Error('cannot decode screenshot'));
      image.src = dataUrl;
    });
  }

  /** Resolves to true if the text was copied. */
  async function writeToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // The async Clipboard API is unavailable on insecure origins and can be
      // blocked by a permissions policy.
      return copyViaTextarea(text);
    }
  }

  function copyViaTextarea(text) {
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.cssText = 'position: fixed; top: 0; left: -9999px; opacity: 0';

    (document.body || document.documentElement).appendChild(field);
    field.select();

    let copied = false;
    try {
      copied = document.execCommand('copy');
    } catch {
      // Reported to the caller as a failed copy.
    }
    field.remove();
    return copied;
  }

  /**
   * Shows a short message in the bottom-right corner of the page. The toast has
   * its own host so it outlives the overlay; a new toast replaces the previous one.
   */
  function showToast(text, isError = false) {
    window[TOAST_KEY]?.remove();

    const host = document.createElement('div');
    host.style.cssText =
      'all: initial; position: fixed; right: 16px; bottom: 16px; z-index: 2147483647; pointer-events: none';

    const root = host.attachShadow({ mode: 'closed' });
    root.innerHTML = `
      <style>
        .toast {
          display: flex;
          align-items: center;
          gap: 8px;
          max-width: 320px;
          padding: 8px 12px;
          border-radius: 8px;
          background: rgba(24, 24, 27, .94);
          color: #fafafa;
          font: 500 12.5px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
          box-shadow: 0 8px 22px rgba(0, 0, 0, .28);
          opacity: 0;
          transform: translateY(6px);
          transition: opacity .16s ease, transform .16s ease;
        }

        .toast.is-visible {
          opacity: 1;
          transform: none;
        }

        .dot {
          flex: none;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: ${isError ? '#f87171' : '#4ade80'};
        }
      </style>
      <div class="toast" role="status"><span class="dot"></span><span class="text"></span></div>
    `;

    const toast = root.querySelector('.toast');
    root.querySelector('.text').textContent = text;

    (document.documentElement || document.body).appendChild(host);
    window[TOAST_KEY] = host;
    afterFrames(1).then(() => toast.classList.add('is-visible'));

    setTimeout(() => {
      toast.classList.remove('is-visible');
      setTimeout(() => {
        host.remove();
        if (window[TOAST_KEY] === host) delete window[TOAST_KEY];
      }, FADE_DURATION);
    }, TOAST_DURATION);
  }

  function afterFrames(count) {
    return new Promise((resolve) => {
      const tick = () => (--count > 0 ? requestAnimationFrame(tick) : resolve());
      requestAnimationFrame(tick);
    });
  }

  function toHex(r, g, b) {
    return '#' + [r, g, b].map((channel) => channel.toString(16).padStart(2, '0')).join('').toUpperCase();
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  window[INSTANCE_KEY] = new ColorPicker();
})();
