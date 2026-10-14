/**
 * Regenerates src/shared/accessibility/accessibility-text-sizes.css.
 *
 * The accessibility toolbar scales type by redefining the size tokens, which reaches everything
 * sized through `type-*` or Tailwind's own scale. It cannot reach a one-off `text-[9px]`, because
 * there the number is part of the class name. The brand themes have the same problem with
 * `bg-[#f1ece7]`, and it has the same answer: override the generated class.
 *
 * Without this, turning the text size up leaves the ~200 smallest labels in the product at their
 * original size, and those are the labels a visitor most needs enlarged.
 *
 * Run: node scripts/generate-a11y-text-sizes.mjs
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'src';
const OUT = 'src/shared/accessibility/accessibility-text-sizes.css';

/** Tailwind keeps the variant in the class name, so it has to be reproduced in the selector. */
const SIZE_PATTERN = /(?:([a-z-]+):)?\btext-\[([0-9.]+)(px|rem)\]/g;

const VARIANT_PSEUDO = {
  hover: ':hover',
  focus: ':focus',
  'focus-visible': ':focus-visible',
  active: ':active',
  disabled: ':disabled',
};

/** Responsive variants are media queries, not pseudo-classes, and are reported instead of guessed. */
const BREAKPOINTS = { sm: '40rem', md: '48rem', lg: '64rem', xl: '80rem' };

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry).split('\\').join('/');
    if (statSync(path).isDirectory()) walk(path, files);
    else if (/\.(tsx?|css)$/.test(entry)) files.push(path);
  }
  return files;
}

const found = new Map();
const skipped = new Map();

for (const file of walk(SRC)) {
  const source = readFileSync(file, 'utf8');
  for (const [, variant, size, unit] of source.matchAll(SIZE_PATTERN)) {
    if (variant && !(variant in VARIANT_PSEUDO) && !(variant in BREAKPOINTS)) {
      const label = `${variant}:text-[${size}${unit}]`;
      skipped.set(label, (skipped.get(label) ?? 0) + 1);
      continue;
    }
    const key = [variant ?? '', size, unit].join('|');
    found.set(key, (found.get(key) ?? 0) + 1);
  }
}

const escape = (cls) => cls.replace(/([[\]:.])/g, '\\$1');

const rules = [...found.keys()].sort().map((key) => {
  const [variant, size, unit] = key.split('|');

  const className = (variant ? `${variant}:` : '') + `text-[${size}${unit}]`;
  const pseudo = variant && variant in VARIANT_PSEUDO ? VARIANT_PSEUDO[variant] : '';
  const selector = `html[data-a11y-scaled='true'] :is(#root, [data-a11y-surface]) .${escape(className)}${pseudo}`;
  const declaration = `  font-size: calc(${size}${unit} * var(--a11y-font-scale, 1));`;

  if (variant && variant in BREAKPOINTS) {
    return `@media (width >= ${BREAKPOINTS[variant]}) {\n  ${selector} {\n  ${declaration}\n  }\n}`;
  }
  return `${selector} {\n${declaration}\n}`;
});

const callSites = [...found.values()].reduce((total, count) => total + count, 0);

const header = [
  '/*',
  ' * GENERATED FILE. Do not hand-edit.',
  ' * Regenerate with: node scripts/generate-a11y-text-sizes.mjs',
  ' *',
  ' * Scales the one-off `text-[Npx]` classes with the accessibility text-size control. The number',
  ' * is part of the class name, so no token can reach it, but a rule on that same class can.',
  ' *',
  ' * Scoped to the app: #root plus any [data-a11y-surface], which is how a portalled dialog',
  ' * stays in scope. The toolbar itself carries neither, so it keeps its own size, and the',
  ' * scaled attribute means nothing changes until a visitor asks for larger text.',
  ' *',
  ` * ${found.size} rules over ${callSites} call sites.`,
  ' */',
  '',
  '',
].join('\n');

writeFileSync(OUT, header + rules.join('\n\n') + '\n');
console.log(`${found.size} rules across ${callSites} call sites -> ${OUT}`);

if (skipped.size > 0) {
  console.log('\nSkipped - variant needs a hand-written rule:');
  for (const [label, count] of [...skipped].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${count}  ${label}`);
  }
}
