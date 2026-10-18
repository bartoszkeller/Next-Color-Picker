import { TOP_LAYER } from './constants';

/** Resolves after the given number of animation frames. */
export function afterFrames(count: number): Promise<void> {
  return new Promise((resolve) => {
    const tick = () => (--count > 0 ? requestAnimationFrame(tick) : resolve());
    requestAnimationFrame(tick);
  });
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Creates a fixed, page-isolated host element with a closed shadow root. The
 * `all: initial` reset keeps page styles from leaking onto the host itself.
 */
export function createOverlayHost(css: string): { host: HTMLElement; root: ShadowRoot } {
  const host = document.createElement('div');
  host.style.cssText = `all: initial; position: fixed; z-index: ${TOP_LAYER}; ${css}`;

  const root = host.attachShadow({ mode: 'closed' });
  return { host, root };
}

/** Creates an element with the given class and children. */
export function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.append(...children);
  return element;
}

/** Creates a style element; markup is never parsed, so no HTML injection is possible. */
export function createStyle(css: string): HTMLStyleElement {
  const style = document.createElement('style');
  style.textContent = css;
  return style;
}

/** Appends an element to the page, which may not have a body yet. */
export function appendToPage(element: HTMLElement): void {
  (document.documentElement || document.body).appendChild(element);
}
