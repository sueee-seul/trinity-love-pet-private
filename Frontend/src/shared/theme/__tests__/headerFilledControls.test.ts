// The app tsconfig does not load Node types. This test reads the disk, so it asks for them.
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';

/**
 * The top bar paints its text in the shell ink. A filled control inside the bar, such as the
 * Sign up link, brings its own text colour for its fill. On Paper, Strawberry and Garden the fill
 * is the shell ink itself, so if the bar rule reached the control its label measured 1:1.
 *
 * jsdom does not resolve the cascade with custom properties, so this asks the parsed stylesheet
 * which bar rules set a text colour, and checks the control matches none of them. The stylesheet
 * is read with node fs because Vite returns an empty string for `?raw` on a stylesheet.
 */

// A named path, not a literal inside `new URL()`: Vite rewrites a literal there into an asset URL,
// which node fs cannot open.
const STYLESHEET_PATH = '../brand-themes.css';
const BRAND_THEMES_CSS = readFileSync(
  fileURLToPath(new URL(STYLESHEET_PATH, import.meta.url)),
  'utf8',
);

/** Selectors of the rules that set `color` on something inside the sticky bar. */
const barColourSelectors = (): string[] => {
  const style = document.createElement('style');
  style.textContent = BRAND_THEMES_CSS;
  document.head.append(style);
  const sheet = style.sheet;
  if (sheet === null) {
    throw new Error('brand-themes.css did not parse');
  }

  return [...sheet.cssRules]
    .filter((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule)
    .filter((rule) => rule.selectorText.includes('header.sticky') && rule.style.color !== '')
    .map((rule) => rule.selectorText);
};

describe('filled controls in the top bar', () => {
  beforeEach(() => {
    document.documentElement.setAttribute('data-theme', 'plain-light');
    document.head.innerHTML = '';
    document.body.innerHTML = `
      <header class="sticky bg-surface-deep">
        <nav><a id="nav-link" href="/stays">My Stays</a></nav>
        <a id="sign-up" class="bg-action-dark text-on-action-dark" href="/signup">
          <span id="sign-up-label">Sign up</span>
        </a>
      </header>`;
  });

  it('finds the bar text rules, so the check below cannot pass vacuously', () => {
    const selectors = barColourSelectors();
    const navLink = document.getElementById('nav-link');

    expect(selectors.length).toBeGreaterThan(0);
    expect(selectors.some((selector) => navLink?.matches(selector))).toBe(true);
  });

  it('leaves the text on a filled action control to the control', () => {
    const selectors = barColourSelectors();
    const reached = ['sign-up', 'sign-up-label'].filter((id) => {
      const element = document.getElementById(id);
      return selectors.some((selector) => element?.matches(selector));
    });

    expect(reached).toEqual([]);
  });
});
