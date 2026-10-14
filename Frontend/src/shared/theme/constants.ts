import type { ThemeIconName } from './icons/iconNames';

export const BRAND_THEME_STORAGE_KEY = 'tlp.brandTheme.v1';

/**
 * `simple` is the absence of a theme attribute, which leaves the original apricot palette in
 * place. Keeping it in the list gives the picker a way back without a separate reset control.
 *
 * Milk Cream is the Strawberry Cream look the site shipped until September 2026. When Strawberry
 * Cream became the default theme and gained its gradients and decorations, the old look stayed
 * available under its own name.
 *
 * The order is the order every picker shows: the romantic themes, then the luxury ones, and the
 * minimal ones last, as the product owner decided. Inside a group a night mode theme comes last.
 */
export const BRAND_THEMES = [
  'strawberry',
  'milk-cream',
  'garden',
  'moonlight',
  'royal',
  'noir',
  'simple',
  'plain-light',
  'plain-dark',
] as const;
export type BrandTheme = (typeof BRAND_THEMES)[number];

/** The one theme that is the absence of `data-theme`, so the apricot tokens in index.css apply. */
export const UNTHEMED_BRAND_THEME = 'simple' satisfies BrandTheme;

/**
 * What a visitor sees before choosing a theme. Since 7 October 2026 every page, the staff console
 * under `/admin` included, opens in the same theme, so the three portals look like one product;
 * staff who prefer a plain workspace pick Simple in Account Settings, and the choice sticks.
 */
export const CUSTOMER_DEFAULT_BRAND_THEME: BrandTheme = 'strawberry';
export const STAFF_DEFAULT_BRAND_THEME: BrandTheme = CUSTOMER_DEFAULT_BRAND_THEME;
export const STAFF_PATH_PREFIX = '/admin';

/**
 * Before Simple had its own name, the original palette was stored as `default`. Those visitors
 * move to the new default look rather than keep the old palette, as the product owner decided.
 */
export const LEGACY_DEFAULT_STORED_VALUE = 'default';
export const LEGACY_DEFAULT_REPLACEMENT: BrandTheme = 'strawberry';

/**
 * Three families, shown as three groups in every picker, in this order.
 *
 * `romantic` and `luxury` themes are illustrated, with a motif and a picture of their own.
 * `minimal` themes are plain: no motif, no pattern and no picture. They exist because the styled
 * themes are decorative by design, and a workspace someone stares at all day is not always the
 * place for that.
 */
export const BRAND_THEME_FAMILIES = ['romantic', 'luxury', 'minimal'] as const;
export type BrandThemeFamily = (typeof BRAND_THEME_FAMILIES)[number];

/**
 * The themes the pickers tag as night mode. The product owner chose these two. Maison Noir also
 * uses a dark colour scheme, but it is shown as a luxury look, not as a night mode.
 */
export const NIGHT_MODE_BRAND_THEMES: readonly BrandTheme[] = ['plain-dark', 'moonlight'];

export const isNightModeTheme = (theme: BrandTheme): boolean =>
  NIGHT_MODE_BRAND_THEMES.includes(theme);

interface BrandThemeDescription {
  family: BrandThemeFamily;
  /** Swatches for the picker: page, accent, card. */
  swatches: readonly [string, string, string];
  /** The package gives each theme a motif; `default` borrows the product's own paw. */
  symbol: ThemeIconName;
}

export const BRAND_THEME_DETAILS: Record<BrandTheme, BrandThemeDescription> = {
  simple: {
    family: 'minimal',
    swatches: ['#fff7ee', '#eb9c14', '#ffffff'],
    symbol: 'paw',
  },
  'plain-light': {
    family: 'minimal',
    swatches: ['#f6f4f1', '#6b5138', '#ffffff'],
    symbol: 'home',
  },
  'plain-dark': {
    family: 'minimal',
    swatches: ['#17191c', '#d8c7a8', '#21242a'],
    symbol: 'moon',
  },
  strawberry: {
    family: 'romantic',
    swatches: ['#fff7ef', '#a33e5d', '#fffcf8'],
    symbol: 'bow',
  },
  'milk-cream': {
    family: 'romantic',
    swatches: ['#fbf2e5', '#503733', '#b8904a'],
    symbol: 'heart',
  },
  moonlight: {
    family: 'romantic',
    swatches: ['#14182b', '#ccbbfa', '#22283f'],
    symbol: 'moon',
  },
  garden: {
    family: 'romantic',
    swatches: ['#eff5e9', '#3c644c', '#fcfdf6'],
    symbol: 'flower',
  },
  royal: {
    family: 'luxury',
    swatches: ['#ede0c4', '#715520', '#163b32'],
    symbol: 'crown',
  },
  noir: {
    family: 'luxury',
    swatches: ['#110f10', '#d4b26a', '#f5eee2'],
    symbol: 'star',
  },
};

export const themesInFamily = (family: BrandThemeFamily): readonly BrandTheme[] =>
  BRAND_THEMES.filter((theme) => BRAND_THEME_DETAILS[theme].family === family);
