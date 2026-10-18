/**
 * User settings, kept in the extension's local storage so that they apply on
 * every site and survive browser restarts. Used by the picker and the
 * settings page.
 */
import { ext } from './browser';
import { DEFAULT_FORMAT, findFormat, type ColorFormat } from './color-formats';

export const THEMES = ['system', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

export interface Settings {
  /** Open the picker in the format used last time, instead of defaultFormat. */
  rememberFormat: boolean;
  /** Id of the format the picker opens in when rememberFormat is off. */
  defaultFormat: string;
  theme: Theme;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  rememberFormat: true,
  defaultFormat: DEFAULT_FORMAT.id,
  theme: 'system'
};

const SETTINGS_KEY = 'settings';
const LAST_FORMAT_KEY = 'lastFormat';

/** Resolves to the saved settings, with defaults for anything missing or invalid. */
export async function loadSettings(): Promise<Settings> {
  const stored = await read(SETTINGS_KEY);
  return sanitize(isObject(stored) ? stored : {});
}

export async function saveSettings(settings: Settings): Promise<void> {
  await ext.storage.local.set({ [SETTINGS_KEY]: sanitize({ ...settings }) });
}

/** The format the picker should open in. */
export async function loadInitialFormat(settings: Settings): Promise<ColorFormat> {
  const fallback = findFormat(settings.defaultFormat) ?? DEFAULT_FORMAT;
  if (!settings.rememberFormat) return fallback;

  return findFormat(await read(LAST_FORMAT_KEY)) ?? fallback;
}

/** Remembers the format last switched to; a failed write only means it is forgotten. */
export function saveLastFormat(format: ColorFormat): void {
  ext.storage.local.set({ [LAST_FORMAT_KEY]: format.id }).catch(() => {});
}

async function read(key: string): Promise<unknown> {
  try {
    return (await ext.storage.local.get(key))[key];
  } catch {
    return undefined;
  }
}

function sanitize(value: Record<string, unknown>): Settings {
  return {
    rememberFormat:
      typeof value.rememberFormat === 'boolean' ? value.rememberFormat : DEFAULT_SETTINGS.rememberFormat,
    defaultFormat: findFormat(value.defaultFormat)?.id ?? DEFAULT_SETTINGS.defaultFormat,
    theme: THEMES.includes(value.theme as Theme) ? (value.theme as Theme) : DEFAULT_SETTINGS.theme
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
