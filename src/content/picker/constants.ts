// Must be odd so that a single pixel sits in the center of the lens.
export const SOURCE_PIXELS = 15;
export const ZOOM = 11;
export const LENS_SIZE = SOURCE_PIXELS * ZOOM;
export const CENTER_INDEX = (SOURCE_PIXELS - 1) / 2;
export const CENTER_OFFSET = CENTER_INDEX * ZOOM;

// tabs.captureVisibleTab is rate-limited to about two calls per second in Chrome.
export const RECAPTURE_DELAY = 260;
export const RETRY_DELAY = 500;
export const MAX_RETRIES = 4;

export const CONFIRM_DURATION = 520;
export const FADE_DURATION = 200;
export const LABEL_HEIGHT = 30;
export const LABEL_GAP = 10;
export const EDGE_MARGIN = 6;

// Ctrl + wheel switches the color format. Touchpads send many small wheel
// events, so the format only changes once this much scrolling has added up,
// counted from the last change or after a pause of FORMAT_STEP_RESET ms.
export const FORMAT_STEP_DELTA = 50;
export const FORMAT_STEP_RESET = 200;

export const TOAST_DURATION = 3000;

/** Highest z-index there is, so the overlay stays above the page. */
export const TOP_LAYER = 2147483647;

// Stopped at the overlay so that page-level listeners (hover menus, tooltips,
// canvas apps) do not react while the picker is open.
export const SWALLOWED_EVENTS = [
  'mousemove',
  'mouseover',
  'mouseout',
  'mouseenter',
  'mouseleave',
  'mousedown',
  'mouseup',
  'click',
  'dblclick',
  'auxclick',
  'contextmenu',
  'pointermove',
  'pointerover',
  'pointerout',
  'pointerenter',
  'pointerleave',
  'pointerdown',
  'pointerup',
  'touchstart',
  'touchmove',
  'touchend',
  'dragstart',
  'wheel'
] as const;
