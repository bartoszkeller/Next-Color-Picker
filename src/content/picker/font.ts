/**
 * Loads Instrument Sans, the interface font, into the page for the overlay and
 * the toast. See THIRD_PARTY_NOTICES.md for its license.
 *
 * @font-face rules have no effect inside shadow roots, and the page's Content
 * Security Policy may block font URLs, so the font is bundled into the script
 * and added to the document from memory. It is registered under its own name,
 * so it never replaces a font of the page.
 */
import fontData from '@fontsource-variable/instrument-sans/files/instrument-sans-latin-wght-normal.woff2';

/** Listed in --font-sans in src/shared/styles/theme.css. */
const FAMILY = 'Next Color Picker Sans';

export function loadFont(): void {
  try {
    for (const face of document.fonts) {
      if (face.family.replace(/"/g, '') === FAMILY) return;
    }

    const face = new FontFace(FAMILY, fontData, { weight: '400 700', display: 'block' });
    document.fonts.add(face);
    face.load().catch(() => {});
  } catch {
    // The fallback fonts in --font-sans are used instead.
  }
}
