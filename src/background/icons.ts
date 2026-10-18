import { ext } from '../shared/browser';

const ICON_SIZES = [16, 32, 48, 128] as const;

export type IconSet = Record<number, string>;

export const DEFAULT_ICON = buildIconSet('icons/icon$.png');
export const BLOCKED_ICON = buildIconSet('icons/icon$-blocked.png');

/** How long the blocked icon is shown after a failed injection, in ms. */
const FAILURE_FEEDBACK = 1500;

/** Turns the toolbar icon grey for a moment to signal that the picker cannot run in the tab. */
export function flashBlockedIcon(tabId: number): void {
  setTabIcon(tabId, BLOCKED_ICON);
  setTimeout(() => setTabIcon(tabId, DEFAULT_ICON), FAILURE_FEEDBACK);
}

function setTabIcon(tabId: number, path: IconSet): void {
  // Rejects if the tab has been closed; that case is safe to ignore.
  ext.action.setIcon({ tabId, path }).catch(() => {});
}

/** Decodes the given sizes of an icon set into ImageData, keyed by size. */
export async function loadIconImageData(
  iconSet: IconSet,
  sizes: readonly number[]
): Promise<Record<number, ImageData>> {
  const entries = await Promise.all(
    sizes.map(async (size) => {
      const response = await fetch(ext.runtime.getURL(iconSet[size]!));
      const bitmap = await createImageBitmap(await response.blob());
      const ctx = new OffscreenCanvas(size, size).getContext('2d')!;
      ctx.drawImage(bitmap, 0, 0, size, size);
      return [size, ctx.getImageData(0, 0, size, size)] as const;
    })
  );

  return Object.fromEntries(entries);
}

function buildIconSet(template: string): IconSet {
  return Object.fromEntries(ICON_SIZES.map((size) => [size, template.replace('$', String(size))]));
}
