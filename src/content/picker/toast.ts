import { FADE_DURATION, TOAST_DURATION } from './constants';
import { toastSlot } from './state';
import toastCss from './styles/toast.css';
import { afterFrames, appendToPage, createElement, createOverlayHost, createStyle } from './utils';

/**
 * Shows a short message in the bottom-right corner of the page. The toast has
 * its own host so it outlives the overlay; a new toast replaces the previous one.
 */
export function showToast(text: string, isError = false): void {
  toastSlot.get()?.remove();

  const { host, root } = createOverlayHost('right: 16px; bottom: 16px; pointer-events: none');

  const toast = createElement(
    'div',
    'toast',
    createElement('span', 'dot'),
    createElement('span', 'text', text)
  );
  toast.setAttribute('role', 'status');
  toast.classList.toggle('is-error', isError);
  root.append(createStyle(toastCss), toast);

  appendToPage(host);
  toastSlot.set(host);
  afterFrames(1).then(() => toast.classList.add('is-visible'));

  setTimeout(() => {
    toast.classList.remove('is-visible');
    setTimeout(() => {
      host.remove();
      toastSlot.release(host);
    }, FADE_DURATION);
  }, TOAST_DURATION);
}
