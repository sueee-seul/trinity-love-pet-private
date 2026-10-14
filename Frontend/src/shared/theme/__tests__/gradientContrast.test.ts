import { describe, expect, it } from 'vitest';
import { BRAND_THEMES, UNTHEMED_BRAND_THEME, type BrandTheme } from '../constants';
import { BRAND_PALETTES, type BrandGradientStops, type BrandPalette } from '../palettes';
import {
  INDEX_CSS,
  NORMAL_TEXT,
  THEME_TOKENS,
  blend,
  contrast,
  declarationsIn,
  readSource,
  resolveToken,
} from './themeContrastKit';

/**
 * Text on a gradient sits on every colour between its two stops, so each stop is measured against
 * the text that surface carries. Both stops passing is what keeps the whole run legible, because
 * every stop pair here moves in one direction of lightness.
 */

type Surface = 'hero' | 'shell' | 'action' | 'card' | 'feature';

const SURFACES: readonly Surface[] = ['hero', 'shell', 'action', 'card', 'feature'];

/** Paper and Slate stay flat by the product owner's choice. */
const FLAT_THEMES: readonly BrandTheme[] = ['plain-light', 'plain-dark'];

const SIMPLE_STOPS = declarationsIn(readSource('../theme-gradients.css'), ':root {');

const HERO_BAND = declarationsIn(INDEX_CSS, '.theme-hero-band {');

/** A picture can put any colour under the veil, so both ends of the range are measured. */
const PICTURE_EXTREMES = ['#000000', '#ffffff'] as const;

const stopKey = (surface: Surface, end: 'from' | 'to'): keyof BrandGradientStops =>
  `${surface}-${end}`;

const paletteOf = (theme: BrandTheme): BrandPalette | null =>
  theme === UNTHEMED_BRAND_THEME ? null : BRAND_PALETTES[theme];

/** Both stops of a surface, or null for a theme that has none and so stays flat. */
const stopsOf = (theme: BrandTheme, surface: Surface): readonly [string, string] | null => {
  const palette = paletteOf(theme);
  const read = (end: 'from' | 'to'): string | undefined =>
    palette === null
      ? SIMPLE_STOPS.get(`--theme-${surface}-${end}`)
      : palette[stopKey(surface, end)];
  const from = read('from');
  const to = read('to');
  return from && to ? [from, to] : null;
};

/** The text colours each surface carries, resolved through the real CSS mapping. */
const textOn = (theme: BrandTheme, surface: Surface): readonly string[] => {
  const palette = paletteOf(theme);
  switch (surface) {
    case 'hero':
      return [resolveToken('--color-hero-ink', theme)];
    case 'shell':
      // The top bars colour their text with the shell ink under a theme; Simple uses body ink.
      return [palette ? palette['shell-ink'] : resolveToken('--color-notice-primary', theme)];
    case 'action':
      return [resolveToken('--color-on-action-dark', theme)];
    case 'card':
    case 'feature':
      return ['--color-notice-primary', '--color-notice-secondary', '--color-notice-muted'].map(
        (token) => resolveToken(token, theme),
      );
  }
};

const GRADIENT_THEMES = BRAND_THEMES.filter((theme) => !FLAT_THEMES.includes(theme));

describe('theme gradients', () => {
  it('gives every theme but Paper and Slate a full set of stops', () => {
    const missing = GRADIENT_THEMES.flatMap((theme) =>
      SURFACES.filter((surface) => stopsOf(theme, surface) === null).map(
        (surface) => `${theme}: ${surface}`,
      ),
    );

    expect(missing).toEqual([]);
  });

  it('keeps Paper and Slate flat', () => {
    const present = FLAT_THEMES.flatMap((theme) =>
      SURFACES.filter((surface) => stopsOf(theme, surface) !== null).map(
        (surface) => `${theme}: ${surface}`,
      ),
    );

    expect(present).toEqual([]);
  });

  // A fallback would put a gradient back on Paper and Slate, or paint one stop over the other.
  it('maps every stop straight to the palette, with no fallback', () => {
    const wrong = SURFACES.flatMap((surface) =>
      (['from', 'to'] as const)
        .map((end) => [`--theme-${surface}-${end}`, `var(--brand-${surface}-${end})`] as const)
        .filter(([token, expected]) => THEME_TOKENS.get(token) !== expected)
        .map(([token]) => token),
    );

    expect(wrong).toEqual([]);
  });

  for (const surface of SURFACES) {
    it(`keeps the text on the ${surface} gradient legible at both stops`, () => {
      const failures = GRADIENT_THEMES.flatMap((theme) => {
        const stops = stopsOf(theme, surface) ?? [];
        return stops.flatMap((stop) =>
          textOn(theme, surface)
            .map((text) => ({ text, ratio: contrast(text, stop) }))
            .filter(({ ratio }) => ratio < NORMAL_TEXT)
            .map(({ text, ratio }) => `${theme}: ${text} on ${stop} is ${ratio.toFixed(2)}:1`),
        );
      });

      expect(failures).toEqual([]);
    });
  }

  // Below 768px the veil over the picture runs from one stop to the other, so text can land on
  // either end with any pixel of the picture under it.
  it('keeps hero text legible on the phone veil at both stops, over any picture', () => {
    const veil = parseInt(HERO_BAND.get('--theme-hero-veil') ?? '', 10) / 100;
    const failures = GRADIENT_THEMES.flatMap((theme) => {
      const ink = resolveToken('--color-hero-ink', theme);
      return (stopsOf(theme, 'hero') ?? []).flatMap((stop) =>
        PICTURE_EXTREMES.map((pixel) => blend(stop, pixel, veil))
          .map((ground) => ({
            ground,
            ratio: Math.min(contrast(ink, ground), contrast(blend(ink, ground, 0.8), ground)),
          }))
          .filter(({ ratio }) => ratio < NORMAL_TEXT)
          .map(({ ground, ratio }) => `${theme}: on ${ground} is ${ratio.toFixed(2)}:1`),
      );
    });

    expect(veil).toBeGreaterThan(0);
    expect(failures).toEqual([]);
  });

  // Secondary text on the band is `text-hero-ink/80`, measured on each stop of the gradient.
  it('keeps secondary hero text legible at 80% on both stops', () => {
    const failures = GRADIENT_THEMES.flatMap((theme) => {
      const ink = resolveToken('--color-hero-ink', theme);
      return (stopsOf(theme, 'hero') ?? [])
        .map((stop) => ({ stop, ratio: contrast(blend(ink, stop, 0.8), stop) }))
        .filter(({ ratio }) => ratio < NORMAL_TEXT)
        .map(({ stop, ratio }) => `${theme}: on ${stop} is ${ratio.toFixed(2)}:1`);
    });

    expect(failures).toEqual([]);
  });
});
