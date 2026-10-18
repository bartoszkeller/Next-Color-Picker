/**
 * Icons from Lucide (https://lucide.dev, ISC license), the icon set of shadcn/ui.
 * Built with DOM calls, so no markup is parsed.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

type Shape = [tag: 'circle' | 'path', attributes: Record<string, string>];

const ICONS = {
  circleCheck: [
    ['circle', { cx: '12', cy: '12', r: '10' }],
    ['path', { d: 'm9 12 2 2 4-4' }]
  ],
  circleAlert: [
    ['circle', { cx: '12', cy: '12', r: '10' }],
    ['path', { d: 'M12 8v4' }],
    ['path', { d: 'M12 16h.01' }]
  ]
} satisfies Record<string, Shape[]>;

export type IconName = keyof typeof ICONS;

export function createIcon(name: IconName, className = 'icon'): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  setAttributes(svg, {
    class: className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '2',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true'
  });

  for (const [tag, attributes] of ICONS[name] as Shape[]) {
    const shape = document.createElementNS(SVG_NS, tag);
    setAttributes(shape, attributes);
    svg.append(shape);
  }
  return svg;
}

function setAttributes(element: Element, attributes: Record<string, string>): void {
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
}
