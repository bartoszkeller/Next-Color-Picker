/**
 * Scrolls the page content under the overlay.
 *
 * Wheel events land on the overlay, which is fixed to the viewport, so the
 * browser scrolls the document itself natively. Scroll containers inside the
 * page (side panels, app layouts with overflow: auto) never see the event,
 * so for those the scrolling is done here.
 */

/** Pixels per line for wheel events reported in lines, as Firefox does with some mice. */
const LINE_HEIGHT = 20;

/**
 * Scrolls the innermost scroll container under the pointer that can move in the
 * wheel's direction. Leaves the event alone when that is the document, so that
 * the browser scrolls it with its usual smoothing.
 */
export function scrollUnderPointer(event: WheelEvent, overlay: Element): void {
  const { x, y } = wheelDelta(event);
  const target = document.elementsFromPoint(event.clientX, event.clientY).find((el) => el !== overlay);
  const container = target && findScrollContainer(target, x, y);
  if (!container) return;

  event.preventDefault();
  container.scrollBy({ left: x, top: y });
}

function wheelDelta(event: WheelEvent): { x: number; y: number } {
  const factor =
    event.deltaMode === WheelEvent.DOM_DELTA_LINE
      ? LINE_HEIGHT
      : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
        ? innerHeight
        : 1;

  return { x: event.deltaX * factor, y: event.deltaY * factor };
}

function findScrollContainer(start: Element, x: number, y: number): Element | null {
  const root = document.scrollingElement ?? document.documentElement;

  for (let el: Element | null = start; el && el !== root; el = parentOf(el)) {
    // The body's overflow applies to the viewport unless the root element sets its own.
    if (el === document.body && getComputedStyle(document.documentElement).overflowY === 'visible') continue;

    if (canScroll(el, x, y)) return el;
  }
  return null;
}

function canScroll(el: Element, x: number, y: number): boolean {
  const style = getComputedStyle(el);

  const vertical =
    isScrollable(style.overflowY) &&
    ((y > 0 && el.scrollTop + el.clientHeight < el.scrollHeight - 1) || (y < 0 && el.scrollTop > 0));
  const horizontal =
    isScrollable(style.overflowX) &&
    ((x > 0 && el.scrollLeft + el.clientWidth < el.scrollWidth - 1) || (x < 0 && el.scrollLeft > 0));

  return vertical || horizontal;
}

function isScrollable(overflow: string): boolean {
  return overflow === 'auto' || overflow === 'scroll' || overflow === 'overlay';
}

/** The parent element, stepping out of shadow roots. */
function parentOf(el: Element): Element | null {
  if (el.parentElement) return el.parentElement;

  const root = el.getRootNode();
  return root instanceof ShadowRoot ? root.host : null;
}
