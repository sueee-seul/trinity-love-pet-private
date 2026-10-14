import { describe, expect, it } from 'vitest';
import { BRAND_THEMES, UNTHEMED_BRAND_THEME, type BrandTheme } from '../constants';
import { BRAND_PALETTES, type BrandGradientStops, type BrandPalette } from '../palettes';
import {
  INDEX_CSS,
  LARGE_TEXT,
  NORMAL_TEXT,
  blend,
  contrast,
  declarationsIn,
  luminance,
  resolveToken,
} from './themeContrastKit';

/**
 * Contrast is a promise the themes have to keep, so it is asserted rather than measured once by
 * hand.
 *
 * The palettes are imported, not parsed out of the stylesheet. The CSS is generated from this same
 * module, so there is one set of numbers and no way for the test to pass against a stale copy.
 *
 * Two things live only in CSS: the Simple palette in `index.css`, and the block in
 * `brand-themes.css` that maps semantic tokens onto a palette. `themeContrastKit.ts` reads those
 * from disk and follows their `var()` chains.
 */

/** Gradient stops are optional and measured in gradientContrast.test.ts. */
type ColourKey = Exclude<keyof BrandPalette, 'shadow' | 'color-scheme' | keyof BrandGradientStops>;

/** Foreground, background, what it is, and the ratio it has to clear. */
const PAIRS: ReadonlyArray<readonly [ColourKey, ColourKey, string, number]> = [
  ['ink', 'bg', 'body text on the page', NORMAL_TEXT],
  ['ink', 'surface', 'body text on a card', NORMAL_TEXT],
  ['ink', 'soft', 'body text on a badge', NORMAL_TEXT],
  ['muted', 'surface', 'secondary text on a card', NORMAL_TEXT],
  ['muted', 'bg', 'secondary text on the page', NORMAL_TEXT],
  ['accent', 'bg', 'accent text on the page', NORMAL_TEXT],
  ['accent', 'surface', 'accent text on a card', NORMAL_TEXT],
  ['on-accent', 'accent', 'text on a filled accent', NORMAL_TEXT],
  ['shell-ink', 'shell', 'text in the top bar', NORMAL_TEXT],
  ['hero-ink', 'hero', 'text on the hero panel', NORMAL_TEXT],
  ['success', 'surface', 'success text on a card', LARGE_TEXT],
  ['danger', 'surface', 'danger text on a card', LARGE_TEXT],
  ['border', 'surface', 'a card border', LARGE_TEXT],
  ['border', 'bg', 'a border on the page', LARGE_TEXT],
];

const palettes = Object.entries(BRAND_PALETTES) as ReadonlyArray<[string, BrandPalette]>;

/** Semantic pairs, measured through the real CSS mapping in every theme including Simple. */
const TOKEN_PAIRS: ReadonlyArray<readonly [string, string, string, number]> = [
  ['--color-on-action-dark', '--color-action-dark', 'text on a filled dark control', NORMAL_TEXT],
  ['--color-on-sun', '--color-theme-sun', 'the accessibility launcher icon', NORMAL_TEXT],
  ['--color-field-border', '--color-surface-card', 'an input edge on a card', LARGE_TEXT],
  ['--color-field-border', '--color-surface-cream', 'an input edge on the page', LARGE_TEXT],
  ['--color-hero-ink', '--color-hero', 'text on the hero band', NORMAL_TEXT],
];

/** The WAG monogram is drawn in `text-on-action-dark/75` on the filled control. */
const MONOGRAM_OPACITY = 0.75;

/** Secondary text on the hero band is `text-hero-ink/80`. */
const HERO_SECONDARY_OPACITY = 0.8;

/**
 * A picture can put any colour behind a translucent layer, so a layer over one is measured over
 * pure black and pure white, the two ends of what it could hide.
 */
const PICTURE_EXTREMES = ['#000000', '#ffffff'] as const;

/** A percentage custom property declared in the first index.css rule opening with `opener`. */
const coverIn = (opener: string, name: string): number => {
  const value = declarationsIn(INDEX_CSS, opener).get(name);
  if (value === undefined || !/^\d+%$/.test(value)) {
    throw new Error(`${name} in "${opener}" is "${value}", not a whole percentage`);
  }
  return parseInt(value, 10) / 100;
};

/** How strongly the hero colour veils the picture on a phone. */
const HERO_VEIL = coverIn('.theme-hero-band {', '--theme-hero-veil');

/** How opaque the pet parent content panel is over the page picture: glass since September 2026. */
const PANEL_COVER = coverIn('.parent-content-panel {', '--parent-panel-cover');

/** The opaque surface that carries the text a page would otherwise put on the glass panel. */
const PLATE_RULE_START = INDEX_CSS.indexOf('.parent-plate {');
const PLATE_GROUND = /background-color:\s*([^;]+);/
  .exec(INDEX_CSS.slice(PLATE_RULE_START, INDEX_CSS.indexOf('}', PLATE_RULE_START)))?.[1]
  ?.trim();

/** Every text colour a page puts on a panel plate. */
const PANEL_TEXT_TOKENS = [
  '--color-notice-primary',
  '--color-notice-secondary',
  '--color-notice-muted',
  '--color-accent-foreground',
] as const;

const failuresAcrossThemes = (measure: (theme: BrandTheme) => number, minimum: number): string[] =>
  BRAND_THEMES.map((theme) => {
    const ratio = measure(theme);
    return ratio < minimum ? `${theme}: ${ratio.toFixed(2)}:1 (needs ${minimum}:1)` : null;
  }).filter((failure): failure is string => failure !== null);

describe('theme contrast', () => {
  it('covers every theme that has a palette', () => {
    // Simple is the absence of a theme, so it has no palette of its own.
    expect(palettes.length).toBe(BRAND_THEMES.length - 1);
  });

  for (const [foreground, background, label, minimum] of PAIRS) {
    it(`keeps ${label} legible in every theme`, () => {
      const failures = palettes
        .map(([theme, palette]) => {
          const ratio = contrast(palette[foreground], palette[background]);
          return ratio < minimum ? `${theme}: ${ratio.toFixed(2)}:1 (needs ${minimum}:1)` : null;
        })
        .filter((failure): failure is string => failure !== null);

      expect(failures).toEqual([]);
    });
  }

  for (const [foreground, background, label, minimum] of TOKEN_PAIRS) {
    it(`keeps ${label} legible in every theme, Simple included`, () => {
      const failures = failuresAcrossThemes(
        (theme) => contrast(resolveToken(foreground, theme), resolveToken(background, theme)),
        minimum,
      );

      expect(failures).toEqual([]);
    });
  }

  it('keeps the monogram legible at 75% opacity on a filled dark control', () => {
    const failures = failuresAcrossThemes((theme) => {
      const fill = resolveToken('--color-action-dark', theme);
      const text = blend(resolveToken('--color-on-action-dark', theme), fill, MONOGRAM_OPACITY);
      return contrast(text, fill);
    }, LARGE_TEXT);

    expect(failures).toEqual([]);
  });

  it('keeps secondary text on the hero band legible at 80% in every theme, Simple included', () => {
    const failures = failuresAcrossThemes((theme) => {
      const hero = resolveToken('--color-hero', theme);
      const text = blend(resolveToken('--color-hero-ink', theme), hero, HERO_SECONDARY_OPACITY);
      return contrast(text, hero);
    }, NORMAL_TEXT);

    expect(failures).toEqual([]);
  });

  // Below 768px the band veils its whole picture, so text can land on any part of it.
  it('keeps hero text legible on the phone veil over any picture', () => {
    const failures = failuresAcrossThemes((theme) => {
      const hero = resolveToken('--color-hero', theme);
      const ink = resolveToken('--color-hero-ink', theme);
      return Math.min(
        ...PICTURE_EXTREMES.map((pixel) => {
          const ground = blend(hero, pixel, HERO_VEIL);
          return Math.min(
            contrast(ink, ground),
            contrast(blend(ink, ground, HERO_SECONDARY_OPACITY), ground),
          );
        }),
      );
    }, NORMAL_TEXT);

    expect(failures).toEqual([]);
  });

  // The panel is glass, so it cannot promise contrast; a visitor who asks for less transparency
  // gets it opaque again.
  it('keeps the pet parent panel glass, and opaque under reduced transparency', () => {
    expect(PANEL_COVER).toBeGreaterThanOrEqual(0.5);
    expect(PANEL_COVER).toBeLessThan(1);
    expect(INDEX_CSS).toMatch(
      /@media \(prefers-reduced-transparency: reduce\) \{\s*\.parent-content-panel \{\s*--parent-panel-cover: 100%;/,
    );
  });

  // Text that used to sit on the panel sits on a plate, an opaque card surface, in every theme.
  it('keeps text on a pet parent panel plate legible in every theme', () => {
    expect(PLATE_GROUND).toBe('var(--color-surface-card)');
    const failures = failuresAcrossThemes(
      (theme) =>
        Math.min(
          ...PANEL_TEXT_TOKENS.map((token) =>
            contrast(resolveToken(token, theme), resolveToken('--color-surface-card', theme)),
          ),
        ),
      NORMAL_TEXT,
    );

    expect(failures).toEqual([]);
  });

  it('keeps text legible on the hover shade of a filled control, and the hover visible', () => {
    // brand-themes.css mixes the hover as 84% fill and 16% of the text colour on it.
    const hovers: ReadonlyArray<readonly [string, string, string]> = [
      [
        UNTHEMED_BRAND_THEME,
        resolveToken('--color-action-dark', UNTHEMED_BRAND_THEME),
        resolveToken('--color-action-dark-hover', UNTHEMED_BRAND_THEME),
      ],
      ...palettes.map(
        ([theme, palette]) =>
          [theme, palette.action, blend(palette['on-action'], palette.action, 0.16)] as const,
      ),
    ];
    const problems = hovers.flatMap(([theme, fill, hover]) => {
      const text =
        theme === UNTHEMED_BRAND_THEME
          ? resolveToken('--color-on-action-dark', UNTHEMED_BRAND_THEME)
          : null;
      const onAction = text ?? BRAND_PALETTES[theme as Exclude<BrandTheme, 'simple'>]['on-action'];
      const issues: string[] = [];
      if (contrast(onAction, hover) < NORMAL_TEXT) issues.push(`${theme}: text on hover`);
      if (contrast(fill, hover) < 1.2) issues.push(`${theme}: hover looks like the fill`);
      return issues;
    });

    expect(problems).toEqual([]);
  });

  it('declares a dark colour scheme on exactly the palettes with light text on a dark page', () => {
    const mismatched = palettes
      .filter(([, palette]) => {
        const isDark = luminance(palette.ink) > luminance(palette.bg);
        return (palette['color-scheme'] === 'dark') !== isDark;
      })
      .map(([theme]) => theme);

    expect(mismatched).toEqual([]);
  });
});
