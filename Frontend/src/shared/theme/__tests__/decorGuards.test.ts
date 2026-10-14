// @vitest-environment node
// The app tsconfig does not load Node types. This test reads the disk, so it asks for them.
/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The decorations are pure CSS, so their promises are checked against the stylesheets: they go away
 * for a visitor using a reading colour or a Windows contrast theme, they stop moving under reduced
 * motion, and they only animate properties the browser can move without repainting.
 */

const DECOR_DIR = fileURLToPath(new URL('../decor/', import.meta.url));

const withoutComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');

const DECOR_FILES = readdirSync(DECOR_DIR)
  .filter((name) => name.endsWith('.css'))
  .map((name) => ({ name, css: withoutComments(readFileSync(join(DECOR_DIR, name), 'utf8')) }));

const BASE = DECOR_FILES.find(({ name }) => name === 'decor-base.css')?.css ?? '';

/** The body of the first `@media` block whose condition contains `condition`. */
const mediaBlock = (css: string, condition: string): string => {
  const start = css.indexOf(`@media (${condition}`);
  if (start === -1) {
    return '';
  }
  let depth = 0;
  for (let index = css.indexOf('{', start); index < css.length; index += 1) {
    if (css[index] === '{') depth += 1;
    if (css[index] === '}') depth -= 1;
    if (depth === 0) return css.slice(start, index + 1);
  }
  return '';
};

const MARKERS_WITH_PSEUDO_ELEMENTS = [
  '.theme-key-card',
  '.theme-package-card',
  '.theme-feature-card',
  '.theme-gradient-action',
  '.theme-section-title',
];
const DECORATIVE_ELEMENTS = [
  '.theme-divider',
  '.theme-signature-badge',
  '.theme-hero-ornament',
  '.theme-select-ring',
];

/** Properties a browser can animate on the compositor, without layout or paint. */
const CHEAP_TO_ANIMATE = new Set(['transform', 'translate', 'rotate', 'scale', 'opacity']);

describe('theme decorations in CSS', () => {
  it('has a base file, the shared press motion and one file per decorated theme', () => {
    expect(DECOR_FILES.map(({ name }) => name).sort()).toEqual([
      'decor-base.css',
      'decor-garden.css',
      'decor-milk-cream.css',
      'decor-moonlight.css',
      'decor-noir.css',
      'decor-press.css',
      'decor-royal.css',
      'decor-strawberry.css',
    ]);
  });

  it('hides every decoration under the reading colours', () => {
    const readingColours = BASE.split("html:is([data-a11y-theme='dark']").slice(1).join('');

    for (const element of DECORATIVE_ELEMENTS) {
      expect(readingColours).toContain(element);
    }
    for (const marker of MARKERS_WITH_PSEUDO_ELEMENTS) {
      expect(readingColours).toContain(marker);
    }
    expect(readingColours).toMatch(/\)::before/);
    expect(readingColours).toMatch(/\)::after/);
    expect(readingColours).toContain('display: none !important');
  });

  it('hides every decoration in forced colours', () => {
    const forced = mediaBlock(BASE, 'forced-colors: active');

    for (const selector of [...DECORATIVE_ELEMENTS, ...MARKERS_WITH_PSEUDO_ELEMENTS]) {
      expect(forced).toContain(selector);
    }
    expect(forced).toContain('.theme-pattern');
  });

  it('stops every animation under reduced motion', () => {
    const reduced = mediaBlock(BASE, 'prefers-reduced-motion: reduce');

    expect(reduced).toContain('.theme-hero-ornament');
    expect(reduced).toContain('.theme-wiggle-icon');
    expect(reduced).toContain('.theme-gradient-action::after');
    expect(reduced).toContain('animation: none !important');
    // The press, the release, the card landing, the check pop and the ring all stop too.
    for (const pressTarget of [
      '.theme-package-card',
      '.theme-select-check',
      '.theme-select-ring',
    ]) {
      expect(reduced).toContain(pressTarget);
    }
    expect(reduced).toContain('translate: none !important');
    expect(reduced).toContain('scale: none !important');
  });

  it('only animates properties that do not repaint', () => {
    const offenders = DECOR_FILES.flatMap(({ name, css }) =>
      [...css.matchAll(/@keyframes\s+([\w-]+)\s*\{([\s\S]*?)\n\}/g)].flatMap(
        ([, keyframes, body]) =>
          [...body.matchAll(/([a-z-]+)\s*:/g)]
            .map(([, property]) => property)
            .filter((property) => !CHEAP_TO_ANIMATE.has(property))
            .map((property) => `${name} @keyframes ${keyframes}: ${property}`),
      ),
    );

    expect(offenders).toEqual([]);
  });

  it('uses no filters, which would repaint the decorated area on every frame', () => {
    const offenders = DECOR_FILES.filter(({ css }) => /(^|[\s;{])(backdrop-)?filter\s*:/.test(css));

    expect(offenders.map(({ name }) => name)).toEqual([]);
  });

  /*
   * A nine-slice frame keeps its corners at a fixed size. The slice is measured in the image's own
   * pixels, so the SVG must declare its size: without width and height the browser draws it at a
   * default 300 by 150, and every slice lands in the wrong place.
   */
  it('draws the Milk Cream frame as a nine-slice from an SVG with its own size', () => {
    const milkCream = DECOR_FILES.find(({ name }) => name === 'decor-milk-cream.css')?.css ?? '';

    expect(milkCream).toMatch(/border-image:\s*url\("data:image\/svg\+xml,[^"]+"\)\s*44 round;/);
    expect(decodeURIComponent(milkCream)).toMatch(/<svg[^>]*width='132' height='132'/);
  });
});
