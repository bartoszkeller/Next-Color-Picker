/*
 * Picker entry point, injected into the active tab by the background script on
 * every click of the toolbar button.
 */
import { ColorPicker } from './color-picker';
import { pickerSlot } from './state';

const open = pickerSlot.get();

// Injecting while the picker is open closes it, so the toolbar button acts as a toggle.
if (open) {
  open.cancel();
} else {
  pickerSlot.set(new ColorPicker());
}
