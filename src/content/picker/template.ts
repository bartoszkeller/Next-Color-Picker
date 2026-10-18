import { LABEL_HEIGHT, LENS_SIZE } from './constants';
import pickerCss from './styles/picker.css';
import { createElement, createStyle } from './utils';

/** Elements of the overlay that the picker updates. */
export interface PickerElements {
  layer: HTMLDivElement;
  lens: HTMLDivElement;
  canvas: HTMLCanvasElement;
  label: HTMLDivElement;
  swatch: HTMLSpanElement;
  value: HTMLSpanElement;
}

/** Renders the overlay into the shadow root. */
export function renderPicker(root: ShadowRoot): PickerElements {
  const canvas = createElement('canvas');
  const lens = createElement('div', 'lens', canvas);
  const swatch = createElement('span', 'swatch');
  const value = createElement('span', 'value');
  const label = createElement('div', 'label', swatch, value);
  const layer = createElement('div', 'layer', lens, label);

  const variables = `:host { --lens-size: ${LENS_SIZE}px; --label-height: ${LABEL_HEIGHT}px; }`;
  root.append(createStyle(variables + pickerCss), layer);

  return { layer, lens, canvas, label, swatch, value };
}
