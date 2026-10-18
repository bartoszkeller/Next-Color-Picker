/*
 * Extension popup, opened from the toolbar button's context menu with the
 * settings, or with ?notice=restricted after a click on a page the picker
 * cannot run on. In Firefox the settings also show in the add-ons manager.
 *
 * Every change is saved right away; the picker reads the settings each time
 * it opens.
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

/** How long the notice stays open, in ms; it is meant to read like a toast. */
const NOTICE_DURATION = 3500;

const rememberSwitch = byId<HTMLButtonElement>('remember-format');
const defaultFormatField = byId('default-format-field');
const defaultFormatSelect = byId<HTMLSelectElement>('default-format');
const themeInputs = [...document.querySelectorAll<HTMLInputElement>('input[name="theme"]')];

let settings: Settings = { ...DEFAULT_SETTINGS };

main();

async function main(): Promise<void> {
  const showNotice = new URLSearchParams(location.search).get('notice') === 'restricted';

  settings = await loadSettings();
  applyTheme(document.documentElement, settings.theme);
  onSystemThemeChange(() => applyTheme(document.documentElement, settings.theme));

  if (showNotice) {
    openNotice();
  } else {
    openSettings();
  }
}

function openNotice(): void {
  byId('notice').hidden = false;
  document.addEventListener('click', () => window.close());
  setTimeout(() => window.close(), NOTICE_DURATION);
}

function openSettings(): void {
  byId('settings').hidden = false;
  byId('version').textContent = `v${ext.runtime.getManifest().version}`;

  for (const format of COLOR_FORMATS) {
    defaultFormatSelect.add(new Option(format.name, format.id));
  }
  render();

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
