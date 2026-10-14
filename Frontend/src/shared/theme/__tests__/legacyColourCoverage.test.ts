import { describe, expect, it } from 'vitest';
import { COLOUR_CLASS_PATTERN, COVERED_COLOUR_CLASSES } from '../legacyColourManifest';

/**
 * Guards the generated override layer against drift.
 *
 * `brand-theme-legacy-colours.css` is produced by scripts/generate-theme-legacy-colours.mjs from
 * whatever colours the application currently hard-codes. Since October 2026 every call site paints
 * with a semantic token (`text-notice-primary`, `bg-status-danger-soft`, ...), so the override
 * layer covers no arbitrary classes at all. Nothing stops someone adding another `bg-[#abc123]`
 * later, and if they do it silently stops following the theme on the default palette. This test
 * fails in that case and names the class and the file, so the fix is to use a token.
 *
 * Sources come through `import.meta.glob`, and the covered list through the generator's TypeScript
 * manifest rather than the stylesheet: Vite's CSS pipeline intercepts `?raw` on a stylesheet and
 * returns an empty string, which would make this test pass against nothing.
 *
 * The class pattern comes from the manifest too, so this test and the generator always look for
 * the same hex, rgb() and hsl() classes. Two copies had to be kept in step by hand before.
 */

/** The theme's own files define the palette, so they are not rewritten in terms of it. */
const isThemeOwnFile = (path: string): boolean => path.includes('/shared/theme/');

const sources = import.meta.glob('/src/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const collectClasses = (): Map<string, string[]> => {
  const classes = new Map<string, string[]>();

  for (const [path, source] of Object.entries(sources)) {
    if (isThemeOwnFile(path)) continue;

    for (const [, variant, prefix, colour, opacity] of source.matchAll(COLOUR_CLASS_PATTERN)) {
      const name =
        (variant ? `${variant}:` : '') + `${prefix}-[${colour}]` + (opacity ? `/${opacity}` : '');
      classes.set(name, [...(classes.get(name) ?? []), path]);
    }
  }

  return classes;
};

describe('generated legacy colour coverage', () => {
  const classes = collectClasses();
  const covered = new Set(COVERED_COLOUR_CLASSES);

  it('reads the application sources', () => {
    // An empty glob would make the assertions below pass vacuously.
    expect(Object.keys(sources).length).toBeGreaterThan(100);
  });

  it('hard-codes no colour class anywhere: every colour is a semantic token', () => {
    const hardCoded = [...classes.entries()].map(
      ([name, files]) => `${name}  (${[...new Set(files)].join(', ')})`,
    );

    expect(
      hardCoded,
      'use a semantic token (text-notice-*, bg-surface-*, bg-status-*-soft, border-border-soft)',
    ).toEqual([]);
  });

  it('has a theme override for every arbitrary colour class that still exists', () => {
    const uncovered = [...classes.entries()]
      .filter(([name]) => !covered.has(name))
      .map(([name]) => name);

    expect(uncovered, 'run: node scripts/generate-theme-legacy-colours.mjs').toEqual([]);
  });

  it('does not claim to cover classes the app no longer uses', () => {
    const stale = [...covered].filter((name) => !classes.has(name));

    expect(stale, 'run: node scripts/generate-theme-legacy-colours.mjs').toEqual([]);
  });
});
