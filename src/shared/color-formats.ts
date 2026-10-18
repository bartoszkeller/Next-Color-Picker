/** Formats a sampled color can be shown and copied in, in cycling order. */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface ColorFormat {
  id: string;
  /** Shown while no color is available. */
  placeholder: string;
  /** Shown in the label's badge. */
  name: string;
  format(color: Rgb): string;
}

export const COLOR_FORMATS: readonly ColorFormat[] = [
  {
    id: 'hex',
    placeholder: '#------',
    name: 'HEX',
    format: toHex
  },
  {
    id: 'rgb',
    placeholder: 'rgb(---, ---, ---)',
    name: 'RGB',
    format: ({ r, g, b }) => `rgb(${r}, ${g}, ${b})`
  },
  {
    id: 'hsl',
    placeholder: 'hsl(---, ---%, ---%)',
    name: 'HSL',
    format: (color) => {
      const { h, s, l } = toHsl(color);
      return `hsl(${h}, ${s}%, ${l}%)`;
    }
  },
  {
    id: 'oklch',
    placeholder: 'oklch(---% ----- ---)',
    name: 'OKLCH',
    format: (color) => {
      const { l, c, h } = toOklch(color);
      return `oklch(${l}% ${c} ${h})`;
    }
  }
];

export const DEFAULT_FORMAT = COLOR_FORMATS[0]!;

export function findFormat(id: unknown): ColorFormat | undefined {
  return COLOR_FORMATS.find((format) => format.id === id);
}

/** The format `steps` positions away from the given one, wrapping around. */
export function cycleFormat(current: ColorFormat, steps: number): ColorFormat {
  const count = COLOR_FORMATS.length;
  const index = COLOR_FORMATS.indexOf(current);
  return COLOR_FORMATS[(((index + steps) % count) + count) % count]!;
}

export function toHex({ r, g, b }: Rgb): string {
  return (
    '#' +
    [r, g, b]
      .map((channel) => channel.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

/** Hue in degrees, saturation and lightness in percent, all rounded to integers. */
function toHsl({ r, g, b }: Rgb): { h: number; s: number; l: number } {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;
  if (delta > 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
    h = (h * 60 + 360) % 360;
  }

  return { h: Math.round(h) % 360, s: Math.round(s * 100), l: Math.round(l * 100) };
}

/**
 * OKLCH as used by CSS: lightness in percent, chroma and hue in degrees.
 * Uses the sRGB to Oklab matrices from https://bottosson.github.io/posts/oklab/.
 */
function toOklch({ r, g, b }: Rgb): { l: number; c: number; h: number } {
  const [lr, lg, lb] = [r, g, b].map(toLinear) as [number, number, number];

  const lms = [
    0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb,
    0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb,
    0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb
  ].map(Math.cbrt) as [number, number, number];

  const [l1, m1, s1] = lms;
  const lightness = 0.2104542553 * l1 + 0.793617785 * m1 - 0.0040720468 * s1;
  const a = 1.9779984951 * l1 - 2.428592205 * m1 + 0.4505937099 * s1;
  const bb = 0.0259040371 * l1 + 0.7827717662 * m1 - 0.808675766 * s1;

  const c = round(Math.hypot(a, bb), 3);
  const hue = ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360;
  // Grays have no meaningful hue; rounding noise would otherwise show up as one.
  const h = c === 0 ? 0 : round(hue, 1) % 360;

  return { l: round(lightness * 100, 1), c, h };
}

function toLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function round(value: number, digits: number): number {
  return Number(value.toFixed(digits));
}
