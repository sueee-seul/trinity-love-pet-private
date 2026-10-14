import { beforeEach, describe, expect, it } from 'vitest';
import { THEME_PAGE_IMAGES } from '../assets/pageImages';
import {
  BRAND_THEMES,
  BRAND_THEME_STORAGE_KEY,
  CUSTOMER_DEFAULT_BRAND_THEME,
  STAFF_DEFAULT_BRAND_THEME,
  UNTHEMED_BRAND_THEME,
  themesInFamily,
} from '../constants';
import { defaultThemeForPath, themeFromStoredValue } from '../themeDefaults';
import { applyTheme, readStoredTheme, useBrandThemeStore } from '../themeStore';

describe('brand theme store', () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;
    document.documentElement.style.removeProperty('--theme-page-image');
    document.head.innerHTML = '<link rel="icon" href="/favicon.svg" />';
    useBrandThemeStore.setState({ theme: UNTHEMED_BRAND_THEME, hasChosen: false });
  });

  const iconHref = (): string | null | undefined =>
    document.querySelector('link[rel="icon"]')?.getAttribute('href');

  it('writes the chosen theme onto the document and remembers it', () => {
    useBrandThemeStore.getState().setTheme('moonlight');

    expect(document.documentElement.dataset.theme).toBe('moonlight');
    expect(window.localStorage.getItem(BRAND_THEME_STORAGE_KEY)).toBe('moonlight');
    expect(useBrandThemeStore.getState()).toMatchObject({ theme: 'moonlight', hasChosen: true });
  });

  // The original palette is the absence of an attribute, so Simple has to remove it rather than
  // set `data-theme="simple"`, which would match the mapping block and theme nothing.
  it('removes the attribute for Simple instead of naming it', () => {
    useBrandThemeStore.getState().setTheme('garden');
    useBrandThemeStore.getState().setTheme('simple');

    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(window.localStorage.getItem(BRAND_THEME_STORAGE_KEY)).toBe('simple');
  });

  it('applies every theme in the list', () => {
    BRAND_THEMES.filter((theme) => theme !== UNTHEMED_BRAND_THEME).forEach((theme) => {
      applyTheme(theme);
      expect(document.documentElement.dataset.theme).toBe(theme);
    });
  });

  describe('what a visitor sees before choosing', () => {
    it('opens every page, the staff console included, in Strawberry Cream', () => {
      expect(CUSTOMER_DEFAULT_BRAND_THEME).toBe('strawberry');
      expect(STAFF_DEFAULT_BRAND_THEME).toBe('strawberry');
      expect(defaultThemeForPath('/')).toBe('strawberry');
      expect(defaultThemeForPath('/book')).toBe('strawberry');
      expect(defaultThemeForPath('/parent/stays')).toBe('strawberry');
      expect(defaultThemeForPath('/login')).toBe('strawberry');
      expect(defaultThemeForPath('/admin')).toBe('strawberry');
      expect(defaultThemeForPath('/admin/feedback/42')).toBe('strawberry');
    });

    // A path that only starts with the same letters is not a staff page.
    it('does not treat a lookalike path as a staff page', () => {
      expect(defaultThemeForPath('/administration')).toBe('strawberry');
    });

    it('follows the route while nothing is chosen', () => {
      useBrandThemeStore.getState().syncRouteDefault('/admin');
      expect(useBrandThemeStore.getState().theme).toBe('strawberry');
      expect(document.documentElement.dataset.theme).toBe('strawberry');

      useBrandThemeStore.getState().syncRouteDefault('/book');
      expect(useBrandThemeStore.getState().theme).toBe('strawberry');
      expect(document.documentElement.dataset.theme).toBe('strawberry');
      // Following the route is not a choice, so nothing is written.
      expect(window.localStorage.getItem(BRAND_THEME_STORAGE_KEY)).toBeNull();
    });

    it('keeps a chosen theme on every route', () => {
      useBrandThemeStore.getState().setTheme('royal');
      useBrandThemeStore.getState().syncRouteDefault('/admin');

      expect(useBrandThemeStore.getState().theme).toBe('royal');
      expect(document.documentElement.dataset.theme).toBe('royal');
    });

    it('forgets the choice on reset and goes back to the route default', () => {
      useBrandThemeStore.getState().setTheme('noir');
      useBrandThemeStore.getState().resetToRouteDefault('/admin/profile');

      expect(useBrandThemeStore.getState()).toMatchObject({
        theme: 'strawberry',
        hasChosen: false,
      });
      expect(window.localStorage.getItem(BRAND_THEME_STORAGE_KEY)).toBeNull();

      useBrandThemeStore.getState().syncRouteDefault('/');
      expect(useBrandThemeStore.getState().theme).toBe('strawberry');
    });
  });

  describe('reading a stored choice', () => {
    it('reads a known theme back', () => {
      window.localStorage.setItem(BRAND_THEME_STORAGE_KEY, 'milk-cream');

      expect(readStoredTheme()).toBe('milk-cream');
    });

    it('treats an unknown value as no choice, so the route default applies', () => {
      window.localStorage.setItem(BRAND_THEME_STORAGE_KEY, 'chartreuse');

      expect(readStoredTheme()).toBeNull();
      expect(themeFromStoredValue(null)).toBeNull();
    });

    // The original palette used to be stored as `default`. The product owner moved those visitors
    // to the new default look rather than keep them on the palette now called Simple.
    it('moves the legacy "default" value to Strawberry Cream', () => {
      window.localStorage.setItem(BRAND_THEME_STORAGE_KEY, 'default');

      expect(readStoredTheme()).toBe('strawberry');
    });
  });

  // The tab icon is the brand, so it must not follow the look (product owner, September 2026).
  it('keeps the Wagstay paw as the tab icon in every theme', () => {
    BRAND_THEMES.forEach((theme) => {
      useBrandThemeStore.getState().setTheme(theme);
      expect(iconHref(), theme).toBe('/favicon.svg');
    });
  });

  const pageImage = (): string =>
    document.documentElement.style.getPropertyValue('--theme-page-image');

  /**
   * The background follows the theme. The URL has to come from JavaScript because the pictures
   * are Vite-hashed module imports, so a stylesheet cannot name them.
   */
  it('points the page background at the picture of every romantic and luxury theme', () => {
    [...themesInFamily('romantic'), ...themesInFamily('luxury')].forEach((theme) => {
      useBrandThemeStore.getState().setTheme(theme);
      expect(pageImage(), theme).toBe(`url(${THEME_PAGE_IMAGES[theme]})`);
    });
  });

  it('shows no page picture for a minimal theme', () => {
    themesInFamily('minimal').forEach((theme) => {
      useBrandThemeStore.getState().setTheme(theme);
      expect(pageImage(), theme).toBe('none');
    });
  });

  // Switching to Simple must clear the last theme's picture, not leave it behind.
  it('clears the last picture when Simple is chosen after another theme', () => {
    useBrandThemeStore.getState().setTheme('moonlight');
    useBrandThemeStore.getState().setTheme(UNTHEMED_BRAND_THEME);

    expect(pageImage()).toBe('none');
  });
});
