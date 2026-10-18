import { ext } from '../shared/browser';
import { DEFAULT_ICON, loadIconImageData } from './icons';

/** Icon sizes passed to the declarative rule; the toolbar only uses these two. */
const RULE_ICON_SIZES = [16, 32];

/**
 * Whether the toolbar icon reflects page support. This needs declarativeContent,
 * which only Chrome provides. Elsewhere the icon is always colored.
 */
export const hasPageRules = Boolean(ext.declarativeContent);

/** Pages the picker can normally be injected into. */
export function isSupportedUrl(url: string | undefined): boolean {
  return /^(https?|file):/i.test(url ?? '');
}

/**
 * The Chrome manifest sets the grey icon as the default and this rule swaps in
 * the colored one on supported pages. This avoids reading tab URLs, and the
 * button stays enabled: Chrome opens the extension menu when a disabled button
 * is clicked.
 */
export async function installPageRules(): Promise<void> {
  if (!hasPageRules) return;

  const { declarativeContent } = ext;
  const imageData = await loadIconImageData(DEFAULT_ICON, RULE_ICON_SIZES);

  declarativeContent.onPageChanged.removeRules(undefined, () => {
    declarativeContent.onPageChanged.addRules([
      {
        conditions: [
          new declarativeContent.PageStateMatcher({
            pageUrl: { schemes: ['http', 'https', 'file'] }
          })
        ],
        actions: [new declarativeContent.SetIcon({ imageData })]
      }
    ]);
  });
}
