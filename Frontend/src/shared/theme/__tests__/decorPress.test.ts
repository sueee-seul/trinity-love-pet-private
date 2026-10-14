// @vitest-environment node
// The app tsconfig does not load Node types. This test reads the disk, so it asks for them.
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BRAND_THEME_DETAILS, BRAND_THEMES } from '../constants';

/**
 * The press and impact motion is CSS only, so its promises are checked against the stylesheet:
 * it reaches every decorated theme and no minimal one, the press lands faster than the release,
 * the release overshoots, and a disabled button never moves.
 */

const PRESS_CSS = readFileSync(
  fileURLToPath(new URL('../decor/decor-press.css', import.meta.url)),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '');

const DECORATED_THEMES = BRAND_THEMES.filter(
  (theme) => BRAND_THEME_DETAILS[theme].family !== 'minimal',
);
const MINIMAL_THEMES = BRAND_THEMES.filter(
  (theme) => BRAND_THEME_DETAILS[theme].family === 'minimal',
);

/** Every selector of every style rule, keyframes excluded. */
const ruleSelectors = (): string[] =>
  [...PRESS_CSS.replace(/@keyframes[\s\S]*?\n\}/g, '').matchAll(/([^{}@]+)\{[^{}]*\}/g)]
    .map(([, selector]) => selector.trim().replace(/\s+/g, ' '))
    .filter((selector) => selector.startsWith('html'));

const customProperty = (name: string): string =>
  PRESS_CSS.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1]?.trim() ?? '';

const milliseconds = (value: string): number => Number.parseFloat(value);

describe('press and impact motion', () => {
  it('scopes every rule to the six decorated themes and to no minimal theme', () => {
    const selectors = ruleSelectors();

    expect(selectors.length).toBeGreaterThan(0);
    for (const selector of selectors) {
      for (const theme of DECORATED_THEMES) {
        expect(selector, theme).toContain(`[data-theme='${theme}']`);
      }
      for (const theme of MINIMAL_THEMES) {
        expect(selector, theme).not.toContain(`'${theme}'`);
      }
    }
  });

  it('lands the press within 100 ms and takes longer over the release', () => {
    const pressIn = milliseconds(customProperty('--theme-press-in'));
    const pressOut = milliseconds(customProperty('--theme-press-out'));

    expect(pressIn).toBeLessThanOrEqual(100);
    expect(pressOut).toBeGreaterThan(pressIn);
  });

  // The overshoot is the hit: the face springs past its rest height before it settles.
  it('springs back past the rest position on release', () => {
    const spring = customProperty('--theme-press-spring');
    const points =
      spring
        .match(/cubic-bezier\(([^)]+)\)/)?.[1]
        ?.split(',')
        .map(Number) ?? [];

    expect(points).toHaveLength(4);
    expect(points[3]).toBeGreaterThan(1);
  });

  it('never presses or lifts a disabled button', () => {
    const buttonStates = ruleSelectors().filter((selector) =>
      /\.theme-gradient-action:(active|hover)/.test(selector),
    );

    expect(buttonStates.length).toBeGreaterThan(0);
    for (const selector of buttonStates) {
      expect(selector).toContain(":not(:disabled, [aria-disabled='true'])");
    }
  });
});
