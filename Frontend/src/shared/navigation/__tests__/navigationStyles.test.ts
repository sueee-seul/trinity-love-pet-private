// @vitest-environment node
// The app tsconfig does not load Node types. This test reads the disk, so it asks for them.
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The navigation pills are CSS, so their contrast promise is checked against the stylesheets. The
 * current pill must be the bar's own text pair reversed, because that pair is the one the palette
 * tests already measure, and the signed-in bars' forced text colour must leave the pills alone.
 */

const readCss = (relativePath: string): string =>
  readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8').replace(
    /\/\*[\s\S]*?\*\//g,
    '',
  );

const NAVIGATION_CSS = readCss('../navigation.css');
const BRAND_THEMES_CSS = readCss('../../theme/brand-themes.css');

/** The declarations of the first rule whose whole selector is `selector`, on a line of its own. */
const declarationsOf = (css: string, selector: string): string => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`(^|\\n)\\s*${escaped} \\{`).exec(css);
  return match === null ? '' : css.slice(match.index, css.indexOf('}', match.index));
};

describe('navigation pills', () => {
  it('draws the landing header pill from the hero text pair', () => {
    const hero = declarationsOf(NAVIGATION_CSS, '.nav-pills--hero');

    expect(hero).toContain('--nav-pill-ink: var(--color-hero-ink)');
    expect(hero).toContain('--nav-pill-ground: var(--color-hero)');
  });

  it('draws the signed-in bar pill from the shell text pair under a theme', () => {
    const shell = declarationsOf(NAVIGATION_CSS, 'html[data-theme] .nav-pills--shell');

    expect(shell).toContain('--nav-pill-ink: var(--brand-shell-ink)');
    expect(shell).toContain('--nav-pill-ground: var(--brand-shell)');
  });

  it('fills the current pill with the ink and letters it in the ground', () => {
    const current = declarationsOf(
      NAVIGATION_CSS,
      ".nav-pill:is([aria-current='page'], [aria-current='true'])",
    );

    expect(current).toContain('background-color: var(--nav-pill-ink)');
    expect(current).toContain('color: var(--nav-pill-ground)');
  });

  // A moving header is what NN/g warns against; only the colours change.
  it('changes colour only, and never slides the pill', () => {
    const pill = declarationsOf(NAVIGATION_CSS, '.nav-pill');

    expect(pill).toMatch(/transition:\s*background-color 150ms ease-out,\s*color 150ms ease-out/);
    expect(NAVIGATION_CSS).not.toMatch(/transition:[^;]*(transform|translate|left|width)/);
  });

  // Without this the current pill in a signed-in bar was lettered in the bar's ink on the bar's
  // ink: the forced text colour reaches every link in `header.sticky`.
  it('keeps the signed-in bars from forcing their text colour onto the pills', () => {
    const forcedRules = BRAND_THEMES_CSS.split('html[data-theme]\n  header.sticky\n').slice(1, 3);

    expect(forcedRules).toHaveLength(2);
    for (const rule of forcedRules) {
      expect(rule).toContain('.nav-pill');
    }
  });
});
