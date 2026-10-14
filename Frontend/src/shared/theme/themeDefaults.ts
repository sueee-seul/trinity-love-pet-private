import {
  BRAND_THEMES,
  CUSTOMER_DEFAULT_BRAND_THEME,
  LEGACY_DEFAULT_REPLACEMENT,
  LEGACY_DEFAULT_STORED_VALUE,
  STAFF_DEFAULT_BRAND_THEME,
  STAFF_PATH_PREFIX,
  type BrandTheme,
} from './constants';

const isBrandTheme = (value: unknown): value is BrandTheme =>
  BRAND_THEMES.includes(value as BrandTheme);

/** Whether `pathname` is a staff page, under /admin. */
export const isStaffPath = (pathname: string): boolean =>
  pathname === STAFF_PATH_PREFIX || pathname.startsWith(`${STAFF_PATH_PREFIX}/`);

/** The theme a visitor who has not chosen one sees on `pathname`. */
export const defaultThemeForPath = (pathname: string): BrandTheme =>
  isStaffPath(pathname) ? STAFF_DEFAULT_BRAND_THEME : CUSTOMER_DEFAULT_BRAND_THEME;

/**
 * The theme a stored value stands for, or null when nothing usable is stored.
 *
 * Storage is not shape-checked by anything else: an older build, a hand edit or a removed theme can
 * all leave a value the picker no longer knows. Those read as "no choice", so the route default
 * applies instead of an unknown theme. The legacy `default` value is a real choice, of the palette
 * now called Simple, and maps to the replacement the product owner picked for it.
 */
export const themeFromStoredValue = (stored: string | null): BrandTheme | null => {
  if (stored === LEGACY_DEFAULT_STORED_VALUE) {
    return LEGACY_DEFAULT_REPLACEMENT;
  }
  return isBrandTheme(stored) ? stored : null;
};
