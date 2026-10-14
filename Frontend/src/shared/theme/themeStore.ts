import { create } from 'zustand';
import { THEME_PAGE_IMAGES } from './assets/pageImages';
import { BRAND_THEME_STORAGE_KEY, UNTHEMED_BRAND_THEME, type BrandTheme } from './constants';
import { defaultThemeForPath, themeFromStoredValue } from './themeDefaults';

interface BrandThemeState {
  theme: BrandTheme;
  /**
   * Whether the visitor has picked a theme. Until they do, the theme follows the route they are
   * on: Strawberry Cream on customer pages, Simple under `/admin`.
   */
  hasChosen: boolean;
  setTheme: (theme: BrandTheme) => void;
  /** Applies the route's default theme, unless the visitor has chosen one. */
  syncRouteDefault: (pathname: string) => void;
  /** Forgets the visitor's choice and goes back to the route's default theme. */
  resetToRouteDefault: (pathname: string) => void;
}

/** The theme the visitor chose, or null when nothing usable is stored. */
export const readStoredTheme = (): BrandTheme | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return themeFromStoredValue(window.localStorage.getItem(BRAND_THEME_STORAGE_KEY));
  } catch {
    // Private-browsing modes throw on localStorage access. The picker still works, it just
    // forgets the choice between page loads.
    return null;
  }
};

const writeStoredTheme = (theme: BrandTheme | null): void => {
  try {
    if (theme === null) {
      window.localStorage.removeItem(BRAND_THEME_STORAGE_KEY);
    } else {
      window.localStorage.setItem(BRAND_THEME_STORAGE_KEY, theme);
    }
  } catch {
    // Same as above: losing persistence must never break the control the visitor just used.
  }
};

const currentPathname = (): string =>
  typeof window === 'undefined' ? '/' : window.location.pathname;

/**
 * The custom property the page background reads. Held on `<html>` rather than written into the
 * stylesheet because the pictures are Vite-hashed module imports: their URLs only exist at
 * runtime, so CSS cannot name them. The selectors stay in CSS and only the URL comes from here.
 *
 * The reading colours in `accessibility.css` set this property to `none !important`, which beats
 * this inline value, so a visitor using one never sees a picture whatever the theme.
 */
const PAGE_IMAGE_PROPERTY = '--theme-page-image';

/**
 * Points the page background at the theme's picture. A minimal theme has none, so the property is
 * set to `none` rather than removed, which also clears the picture of the theme chosen before.
 */
const applyPageImage = (theme: BrandTheme): void => {
  const picture = THEME_PAGE_IMAGES[theme];
  document.documentElement.style.setProperty(
    PAGE_IMAGE_PROPERTY,
    picture === null ? 'none' : `url(${picture})`,
  );
};

/**
 * The palette is applied by attribute on `<html>`, not by a React-rendered wrapper, so it is in
 * place for the whole document, including the portalled accessibility toolbar and any modal.
 * Simple removes the attribute instead of setting a value, which is what leaves the original
 * apricot tokens untouched.
 *
 * The tab icon is not touched: it is the Wagstay paw in every theme (see BrandMark).
 */
export const applyTheme = (theme: BrandTheme): void => {
  if (typeof document === 'undefined') {
    return;
  }

  if (theme === UNTHEMED_BRAND_THEME) {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = theme;
  }

  applyPageImage(theme);
};

const storedTheme = readStoredTheme();

export const useBrandThemeStore = create<BrandThemeState>((set, get) => ({
  theme: storedTheme ?? defaultThemeForPath(currentPathname()),
  hasChosen: storedTheme !== null,

  setTheme: (theme): void => {
    applyTheme(theme);
    writeStoredTheme(theme);
    set({ theme, hasChosen: true });
  },

  syncRouteDefault: (pathname): void => {
    if (get().hasChosen) {
      return;
    }
    const theme = defaultThemeForPath(pathname);
    if (theme !== get().theme) {
      applyTheme(theme);
      set({ theme });
    }
  },

  resetToRouteDefault: (pathname): void => {
    const theme = defaultThemeForPath(pathname);
    applyTheme(theme);
    writeStoredTheme(null);
    set({ theme, hasChosen: false });
  },
}));

// The theme has to reach `<html>` before first paint, otherwise the page renders in the apricot
// palette and then visibly swaps once React mounts.
applyTheme(useBrandThemeStore.getState().theme);
