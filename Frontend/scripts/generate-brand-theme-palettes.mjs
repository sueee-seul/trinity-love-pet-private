/**
 * Regenerates src/shared/theme/brand-theme-palettes.css from src/shared/theme/palettes.ts.
 *
 * The palettes live in TypeScript so that `Record<BrandTheme, BrandPalette>` forces every theme to
 * carry a full set of values, and so the contrast test can measure the same numbers the stylesheet
 * is built from. Vite's CSS pipeline intercepts `?raw` on a stylesheet and returns an empty string,
 * so a test cannot read the CSS back. The data has to start in TypeScript.
 *
 * Run: node scripts/generate-brand-theme-palettes.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';

const SOURCE = 'src/shared/theme/palettes.ts';
const OUT = 'src/shared/theme/brand-theme-palettes.css';

/**
 * The source is read and parsed rather than imported: it is TypeScript, and adding a compile step
 * to a one-file generator would cost more than matching two shapes of literal.
 */
const source = readFileSync(SOURCE, 'utf8');

const paletteBlocks = [
  ...source
    .slice(source.indexOf('BRAND_PALETTES'))
    .matchAll(/^ {2}(?:'([a-z-]+)'|([a-z-]+)):\s*\{([\s\S]*?)^ {2}\},$/gm),
];

if (paletteBlocks.length === 0) {
  throw new Error(`No palettes found in ${SOURCE}`);
}

/**
 * Palette fields that are real CSS properties rather than colours. `color-scheme` has to be set on
 * the element itself for the browser to draw dark native controls; a `--brand-*` variable would
 * change nothing on its own.
 */
const CSS_PROPERTY_FIELDS = new Set(['color-scheme']);

const rules = paletteBlocks.map((block) => {
  const theme = block[1] ?? block[2];
  const body = block[3];

  const declarations = [
    ...body.matchAll(/^ {4}(?:'([a-z-]+)'|([a-z-]+)):\s*(?:'([^']*)'|"([^"]*)")\s*,$/gm),
  ].map((entry) => {
    const name = entry[1] ?? entry[2];
    const value = entry[3] ?? entry[4];
    return CSS_PROPERTY_FIELDS.has(name) ? `  ${name}: ${value};` : `  --brand-${name}: ${value};`;
  });

  if (declarations.length === 0) {
    throw new Error(`Palette "${theme}" parsed with no declarations`);
  }

  return `html[data-theme='${theme}'] {\n${declarations.join('\n')}\n}`;
});

const header = [
  '/*',
  ' * GENERATED FILE. Do not hand-edit.',
  ' * Regenerate with: node scripts/generate-brand-theme-palettes.mjs',
  ' *',
  ' * Source of truth: src/shared/theme/palettes.ts. It is TypeScript so that every theme is forced',
  ' * to carry a complete palette, and so the contrast test can assert against the same values.',
  ' *',
  ' * The mapping from these `--brand-*` values onto the project semantic tokens lives in',
  ' * brand-themes.css. color-scheme is set here directly, because only the property itself makes',
  ' * the browser draw native controls dark on a dark palette.',
  ' *',
  ` * ${rules.length} palettes.`,
  ' */',
  '',
  '',
].join('\n');

writeFileSync(OUT, header + rules.join('\n\n') + '\n');
console.log(`${rules.length} palettes -> ${OUT}`);
