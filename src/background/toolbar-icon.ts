/**
 * The toolbar icon, drawn at runtime so that its accent shows a color: the one
 * under the cursor while the picker is open, otherwise the one copied last.
 *
 * The shapes come from src/icons/<scheme>.svg, which are also rendered to the
 * static PNG icons by the build. Shapes filled with ACCENT_COLOR take the color.
 */
import { ext } from '../shared/browser';
import type { ColorScheme } from '../shared/messages';

/** The accent color in the SVG files, shown until a color is copied. */
const ACCENT_COLOR = '#115CFF';
const SIZES = [16, 32];

const COPIED_COLOR_KEY = 'copiedColor';
const SCHEME_KEY = 'toolbarScheme';

interface Shape {
  path: Path2D;
  fill: string;
  accent: boolean;
}

interface IconGeometry {
  size: number;
  shapes: Shape[];
}

let previewColor: string | null = null;
let previewTabId: number | undefined;
let renderId = 0;
const geometries = new Map<ColorScheme, Promise<IconGeometry>>();

/** Shows the color under the cursor, or the copied color again for null. */
export function previewColorInIcon(color: string | null, tabId?: number): Promise<void> {
  previewColor = color;
  previewTabId = color ? tabId : undefined;
  return updateToolbarIcon();
}

export async function keepColorInIcon(color: string): Promise<void> {
  previewColor = null;
  previewTabId = undefined;
  await ext.storage.local.set({ [COPIED_COLOR_KEY]: color });
  await updateToolbarIcon();
}

/** Drops the preview of a tab that was closed while the picker was open. */
export function forgetPreviewOfTab(tabId: number): void {
  if (tabId === previewTabId) previewColorInIcon(null);
}

export async function setToolbarScheme(scheme: ColorScheme): Promise<void> {
  const stored = await ext.storage.local.get(SCHEME_KEY);
  if (stored[SCHEME_KEY] === scheme) return;

  await ext.storage.local.set({ [SCHEME_KEY]: scheme });
  await updateToolbarIcon();
}

export async function updateToolbarIcon(): Promise<void> {
  // Renders can overlap while the cursor moves; only the latest one is applied.
  const id = ++renderId;

  const stored = await ext.storage.local.get([COPIED_COLOR_KEY, SCHEME_KEY]);
  const scheme: ColorScheme = stored[SCHEME_KEY] === 'dark' ? 'dark' : 'light';
  const color = previewColor ?? (stored[COPIED_COLOR_KEY] as string | undefined) ?? ACCENT_COLOR;

  const imageData = await renderIcon(scheme, color);
  if (id !== renderId) return;

  // Rejects for an invalid color, which only the picker could send; the icon stays as it is.
  await ext.action.setIcon({ imageData }).catch(() => {});
}

async function renderIcon(scheme: ColorScheme, color: string): Promise<Record<number, ImageData>> {
  const { size, shapes } = await loadGeometry(scheme);

  return Object.fromEntries(
    SIZES.map((pixels) => {
      const ctx = new OffscreenCanvas(pixels, pixels).getContext('2d')!;
      ctx.scale(pixels / size, pixels / size);
      for (const shape of shapes) {
        ctx.fillStyle = shape.accent ? color : shape.fill;
        ctx.fill(shape.path);
      }
      return [pixels, ctx.getImageData(0, 0, pixels, pixels)];
    })
  );
}

function loadGeometry(scheme: ColorScheme): Promise<IconGeometry> {
  let geometry = geometries.get(scheme);
  if (!geometry) {
    geometry = fetch(ext.runtime.getURL(`icons/${scheme}.svg`))
      .then((response) => response.text())
      .then(parseSvg);
    geometries.set(scheme, geometry);
  }
  return geometry;
}

/**
 * Reads a flat SVG made of filled <path> and <rect> elements, as exported by
 * design tools, with optional transform attributes.
 */
function parseSvg(svg: string): IconGeometry {
  const size = Number(/viewBox="[\d.-]+ [\d.-]+ ([\d.]+)/.exec(svg)?.[1] ?? 0) || 24;

  const shapes = [...svg.matchAll(/<(path|rect)\b[^>]*>/g)].map(([tag, name]) => {
    const fill = attribute(tag, 'fill') || '#000';
    const shape = name === 'rect' ? rectPath(tag) : new Path2D(attribute(tag, 'd'));

    const path = new Path2D();
    path.addPath(shape, parseTransform(attribute(tag, 'transform')));
    return { path, fill, accent: fill.toUpperCase() === ACCENT_COLOR };
  });

  return { size, shapes };
}

function rectPath(tag: string): Path2D {
  const [x, y, width, height, rx] = ['x', 'y', 'width', 'height', 'rx'].map((name) =>
    Number(attribute(tag, name) || 0)
  ) as [number, number, number, number, number];

  const path = new Path2D();
  path.roundRect(x, y, width, height, rx);
  return path;
}

/** Supports the transform functions design tools export: matrix, translate, rotate and scale. */
function parseTransform(transform: string): DOMMatrix {
  const matrix = new DOMMatrix();

  for (const [, name, list] of transform.matchAll(/(\w+)\(([^)]*)\)/g)) {
    const values = list!
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);
    const [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0] = values;

    if (name === 'matrix') matrix.multiplySelf(new DOMMatrix([a, b, c, d, e, f]));
    else if (name === 'translate') matrix.translateSelf(a, b);
    else if (name === 'scale') matrix.scaleSelf(a, values.length > 1 ? b : a);
    else if (name === 'rotate') matrix.translateSelf(b, c).rotateSelf(a).translateSelf(-b, -c);
  }
  return matrix;
}

function attribute(tag: string, name: string): string {
  return new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? '';
}
