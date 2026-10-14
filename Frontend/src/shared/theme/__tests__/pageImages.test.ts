// The app tsconfig does not load Node types. This test reads the disk, so it asks for them.
/// <reference types="node" />
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { SELECTABLE_CONTRAST_THEMES } from '../../accessibility/constants';
import { THEME_PAGE_IMAGES } from '../assets/pageImages';
import { BRAND_THEMES, BRAND_THEME_DETAILS, type BrandTheme } from '../constants';

/**
 * Every romantic and luxury theme has its own picture, and no two share one. A shared picture
 * would make the second theme look like it changed nothing. Minimal themes have no picture.
 */

// Named paths, not literals inside `new URL()`: Vite rewrites a literal there into an asset URL,
// which node fs cannot open.
const ASSETS_DIRECTORY = '../assets/';
const ACCESSIBILITY_STYLESHEET = '../../accessibility/accessibility.css';
const INDEX_STYLESHEET = '../../../index.css';

const readFromHere = (relativePath: string): Buffer =>
  readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)));

/** The file behind an imported asset URL. Vite keeps the file name and may add a query. */
const pictureFile = (url: string): Buffer => {
  const fileName = url.split(/[?#]/)[0].split('/').pop() ?? '';
  return readFromHere(`${ASSETS_DIRECTORY}${fileName}`);
};

const PAGE_IMAGE_PROPERTY = '--theme-page-image';

const isMinimal = (theme: BrandTheme): boolean => BRAND_THEME_DETAILS[theme].family === 'minimal';
const PICTURE_THEMES = BRAND_THEMES.filter((theme) => !isMinimal(theme));

/** The picture URL of a theme that must have one. */
const pictureOf = (theme: BrandTheme): string => {
  const picture = THEME_PAGE_IMAGES[theme];
  if (picture === null) {
    throw new Error(`${theme} has no picture`);
  }
  return picture;
};

describe('theme page pictures', () => {
  it('gives every romantic and luxury theme a picture', () => {
    PICTURE_THEMES.forEach((theme) => {
      expect(THEME_PAGE_IMAGES[theme], theme).toMatch(/\.webp/);
    });
  });

  it('gives no minimal theme a picture', () => {
    const minimalWithPicture = BRAND_THEMES.filter(
      (theme) => isMinimal(theme) && THEME_PAGE_IMAGES[theme] !== null,
    );

    expect(minimalWithPicture).toEqual([]);
  });

  it('gives each picture theme a different picture URL', () => {
    const urls = PICTURE_THEMES.map(pictureOf);

    expect(new Set(urls).size).toBe(PICTURE_THEMES.length);
  });

  // Two names can still hold the same bytes, so the files themselves are compared too.
  it('ships a different picture file for each picture theme', () => {
    const digests = PICTURE_THEMES.map((theme) =>
      createHash('sha256')
        .update(pictureFile(pictureOf(theme)))
        .digest('hex'),
    );

    expect(new Set(digests).size).toBe(PICTURE_THEMES.length);
  });
});

/**
 * The reading colours must show no picture at all. They win by setting the property to
 * `none !important`, which beats the inline value `themeStore` writes onto `<html>`.
 *
 * jsdom does not resolve the cascade with custom properties, so this asks the parsed stylesheet
 * which rules match `<html>` for each reading colour and set the property. The stylesheet is read
 * with node fs because Vite returns an empty string for `?raw` on a stylesheet.
 */
describe('reading colours and the theme picture', () => {
  const root = document.documentElement;

  const pictureRules = (): CSSStyleRule[] => {
    const style = document.createElement('style');
    style.textContent = readFromHere(ACCESSIBILITY_STYLESHEET).toString('utf8');
    document.head.append(style);
    const sheet = style.sheet;
    if (sheet === null) {
      throw new Error('accessibility.css did not parse');
    }

    return [...sheet.cssRules]
      .filter((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule)
      .filter((rule) => rule.style.getPropertyValue(PAGE_IMAGE_PROPERTY) !== '');
  };

  const rulesMatchingRoot = (): CSSStyleRule[] =>
    pictureRules().filter((rule) => root.matches(rule.selectorText));

  afterEach(() => {
    delete root.dataset.a11yTheme;
    document.head.innerHTML = '';
  });

  it('removes the picture under every reading colour, greyscale included', () => {
    const uncovered = SELECTABLE_CONTRAST_THEMES.filter((mode) => {
      root.dataset.a11yTheme = mode;
      return !rulesMatchingRoot().some(
        (rule) =>
          rule.style.getPropertyValue(PAGE_IMAGE_PROPERTY).trim() === 'none' &&
          rule.style.getPropertyPriority(PAGE_IMAGE_PROPERTY) === 'important',
      );
    });

    expect(uncovered).toEqual([]);
  });

  it('leaves the picture alone when no reading colour is on', () => {
    root.dataset.a11yTheme = 'default';

    expect(rulesMatchingRoot()).toEqual([]);
  });

  // jsdom cannot turn forced colours on, so this checks the rule is there and says the right thing.
  it('removes the picture in forced colours', () => {
    const style = document.createElement('style');
    style.textContent = readFromHere(ACCESSIBILITY_STYLESHEET).toString('utf8');
    document.head.append(style);

    const forcedColourRules = [...(style.sheet?.cssRules ?? [])]
      .filter((rule): rule is CSSMediaRule => rule instanceof CSSMediaRule)
      .filter((rule) => rule.media.mediaText.includes('forced-colors: active'))
      .flatMap((rule) => [...rule.cssRules])
      .filter((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule);

    expect(
      forcedColourRules.some(
        (rule) =>
          root.matches(rule.selectorText) &&
          rule.style.getPropertyValue(PAGE_IMAGE_PROPERTY).trim() === 'none' &&
          rule.style.getPropertyPriority(PAGE_IMAGE_PROPERTY) === 'important',
      ),
    ).toBe(true);
  });
});

/**
 * The portal pages paint the picture on a fixed layer the size of the window. As a background of
 * the page it was scaled to the page's height, and a long page blew the picture up several times.
 */
describe('the portal page picture', () => {
  const indexCss = (): string =>
    readFromHere(INDEX_STYLESHEET)
      .toString('utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '');

  const ruleBody = (css: string, selector: string): string => {
    const start = css.indexOf(`${selector} {`);
    return start === -1 ? '' : css.slice(start, css.indexOf('}', start));
  };

  it('keeps the picture one screen in size on a fixed layer behind the page', () => {
    const css = indexCss();
    const layer = ruleBody(css, '.bg-theme-page::before');

    expect(ruleBody(css, '.bg-theme-page')).toContain('isolation: isolate');
    expect(layer).toContain('position: fixed');
    expect(layer).toContain('inset: 0');
    expect(layer).toContain('z-index: -1');
    expect(layer).toContain('background-image: var(--theme-page-image, none)');
    expect(layer).toContain('background-size: cover');
  });

  // A fixed background is repainted on every scroll frame; a fixed element is composited.
  it('never uses a fixed background attachment', () => {
    expect(indexCss()).not.toMatch(/background-attachment:\s*fixed/);
  });
});
