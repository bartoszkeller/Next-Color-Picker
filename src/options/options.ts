/*
 * Settings page, opened from the toolbar button's context menu. Every change
 * is saved right away; the picker reads the settings each time it opens.
 */
import { ext } from '../shared/browser';
import { COLOR_FORMATS } from '../shared/color-formats';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  THEMES,
  type Settings,
  type Theme
} from '../shared/settings';
import { applyTheme, onSystemThemeChange } from '../shared/theme';

const rememberSwitch = byId<HTMLButtonElement>('remember-format');
const defaultFormatField = byId<HTMLElement>('default-format-field');
const defaultFormatSelect = byId<HTMLSelectElement>('default-format');
const themeInputs = [...document.querySelectorAll<HTMLInputElement>('input[name="theme"]')];

let settings: Settings = { ...DEFAULT_SETTINGS };

main();

async function main(): Promise<void> {
  for (const format of COLOR_FORMATS) {
    defaultFormatSelect.add(new Option(format.name, format.id));
  }
  byId('version').textContent = `Version ${ext.runtime.getManifest().version}`;

  settings = await loadSettings();
  render();

  onSystemThemeChange(() => applyTheme(document.documentElement, settings.theme));
  rememberSwitch.addEventListener('click', () => update({ rememberFormat: !settings.rememberFormat }));
  defaultFormatSelect.addEventListener('change', () => update({ defaultFormat: defaultFormatSelect.value }));
  for (const input of themeInputs) {
    input.addEventListener('change', () => {
      if (THEMES.includes(input.value as Theme)) update({ theme: input.value as Theme });
    });
  }
}

function update(changes: Partial<Settings>): void {
  settings = { ...settings, ...changes };
  render();
  // Always the complete settings, so quick successive changes cannot undo each other.
  saveSettings(settings).catch((error: unknown) => console.error('Could not save the settings', error));
}

function render(): void {
  applyTheme(document.documentElement, settings.theme);

  rememberSwitch.setAttribute('aria-checked', String(settings.rememberFormat));
  defaultFormatField.hidden = settings.rememberFormat;
  defaultFormatSelect.value = settings.defaultFormat;

  for (const input of themeInputs) input.checked = input.value === settings.theme;
}

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element #${id}`);
  return element as T;
}
