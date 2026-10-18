/**
 * User preferences, kept in the extension's local storage so that they apply
 * on every site and survive browser restarts.
 */
import { ext } from '../../shared/browser';
import { findFormat, type ColorFormat } from './color-formats';

const FORMAT_KEY = 'colorFormat';

/** Resolves to the last chosen color format, or undefined if none was saved. */
export async function loadColorFormat(): Promise<ColorFormat | undefined> {
  try {
    const stored = await ext.storage.local.get(FORMAT_KEY);
    return findFormat(stored[FORMAT_KEY]);
  } catch {
    return undefined;
  }
}

export function saveColorFormat(format: ColorFormat): void {
  // A failed write only means the choice is not remembered next time.
  ext.storage.local.set({ [FORMAT_KEY]: format.id }).catch(() => {});
}
