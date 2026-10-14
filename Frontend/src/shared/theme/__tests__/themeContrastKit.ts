// The app tsconfig does not load Node types. These helpers read the disk, so they ask for them.
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { UNTHEMED_BRAND_THEME, type BrandTheme } from '../constants';
import { BRAND_PALETTES, type BrandPalette } from '../palettes';

/**
 * Colour maths and CSS reading shared by the contrast tests. Not a test file itself: vitest only
 * collects `*.test.*`.
 *
 * Stylesheets are read with node fs. Vite returns an empty string for `?raw` on a stylesheet, but
 * it does not stand between the test and the disk.
 */

/** WCAG 2.1: 4.5:1 for normal text, 3:1 for large text and UI boundaries. */
export const NORMAL_TEXT = 4.5;
export const LARGE_TEXT = 3;

const channel = (value: number): number =>
  value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;

const rgbChannels = (hex: string): number[] =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

export const luminance = (hex: string): number => {
  const [r, g, b] = rgbChannels(hex).map((value) => channel(value / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const contrast = (a: string, b: string): number => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
};

/** What a browser paints for `foreground` at `opacity` over an opaque `background`. */
export const blend = (foreground: string, background: string, opacity: number): string => {
  const under = rgbChannels(background);
  const mixed = rgbChannels(foreground).map((value, i) =>
    Math.round(opacity * value + (1 - opacity) * under[i]),
  );
  return '#' + mixed.map((value) => value.toString(16).padStart(2, '0')).join('');
};

export const readSource = (relativePath: string): string =>
  readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');

/** The custom properties declared in the first block opening with `opener`. None of them nest. */
export const declarationsIn = (css: string, opener: string): ReadonlyMap<string, string> => {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const start = source.indexOf(opener);
  if (start === -1) {
    throw new Error(`No block opening with "${opener}"`);
  }

  const body = source.slice(start + opener.length, source.indexOf('}', start));
  return new Map(
    [...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]),
  );
};

export const INDEX_CSS = readSource('../../../index.css');
export const DEFAULT_TOKENS = declarationsIn(INDEX_CSS, '@theme {');
export const THEME_TOKENS = declarationsIn(readSource('../brand-themes.css'), 'html[data-theme] {');

const BRAND_PREFIX = '--brand-';

const isPaletteKey = (palette: BrandPalette, key: string): key is keyof BrandPalette =>
  key in palette;

/**
 * Follows a token's `var()` chain to a hex colour the way the browser would on `<html>`: the theme
 * mapping first, then the Simple `@theme` value, and `--brand-*` from the palette. A value this
 * cannot measure, such as `color-mix()`, fails the test loudly instead of being skipped.
 */
export const resolveToken = (name: string, theme: BrandTheme): string => {
  const palette = theme === UNTHEMED_BRAND_THEME ? null : BRAND_PALETTES[theme];
  const value = (palette && THEME_TOKENS.get(name)) ?? DEFAULT_TOKENS.get(name);
  if (value === undefined) {
    throw new Error(`${name} is not declared for ${theme}`);
  }

  const reference = /^var\((--[\w-]+)\)$/.exec(value);
  if (!reference) {
    if (!/^#[0-9a-f]{6}$/i.test(value)) {
      throw new Error(`${name} is "${value}" for ${theme}, which this test cannot measure`);
    }
    return value.toLowerCase();
  }

  const target = reference[1];
  if (!target.startsWith(BRAND_PREFIX)) {
    return resolveToken(target, theme);
  }

  const key = target.slice(BRAND_PREFIX.length);
  const paletteValue = palette !== null && isPaletteKey(palette, key) ? palette[key] : undefined;
  if (paletteValue === undefined) {
    throw new Error(`${target} has no palette value for ${theme}`);
  }
  return paletteValue;
};
