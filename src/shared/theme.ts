import type { Theme } from './settings';

const DARK_QUERY = '(prefers-color-scheme: dark)';

/** The color scheme to render in; "system" follows the operating system. */
export function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme !== 'system') return theme;
  return matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

/**
 * Applies the theme to an element styled by theme.css: a shadow host or the
 * root element of an extension page.
 */
export function applyTheme(element: HTMLElement, theme: Theme): void {
  element.dataset.theme = resolveTheme(theme);
}

/** Calls back when the system color scheme changes. */
export function onSystemThemeChange(callback: () => void): void {
  matchMedia(DARK_QUERY).addEventListener('change', callback);
}
