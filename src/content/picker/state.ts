/**
 * Page-wide state that must survive between injections.
 *
 * Every click on the toolbar button injects the bundle again, so module-level
 * variables start fresh each time. The window object of the content script is
 * shared between injections, so the open picker and toast are kept there.
 */

interface Cancellable {
  cancel(): void;
}

interface PickerGlobals {
  __nextColorPickerInstance?: Cancellable;
  __nextColorPickerToast?: HTMLElement;
}

const globals: PickerGlobals = window as Window & PickerGlobals;

export const pickerSlot = createSlot('__nextColorPickerInstance');
export const toastSlot = createSlot('__nextColorPickerToast');

function createSlot<K extends keyof PickerGlobals>(key: K) {
  return {
    get: (): PickerGlobals[K] => globals[key],
    set: (value: NonNullable<PickerGlobals[K]>): void => {
      globals[key] = value;
    },
    /** Clears the slot if it still holds the given value. */
    release: (value: NonNullable<PickerGlobals[K]>): void => {
      if (globals[key] === value) delete globals[key];
    }
  };
}
