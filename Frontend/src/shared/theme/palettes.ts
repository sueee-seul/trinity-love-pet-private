import type { BrandTheme } from './constants';

/**
 * The palettes, in TypeScript, as the single source of truth.
 *
 * They used to live only in `brand-themes.css`, which meant nothing checked them: adding a theme
 * left its palette silently missing, and the contrast test had to parse the stylesheet to see the
 * values - which it could not reliably do, because Vite's CSS pipeline intercepts `?raw` on a
 * stylesheet and hands back an empty string.
 *
 * Declared here, `Record<BrandTheme, …>` forces every theme to carry a full palette, and the
 * contrast test measures the same numbers the stylesheet is built from.
 *
 * `brand-theme-palettes.css` is generated from this file:
 *   node scripts/generate-brand-theme-palettes.mjs
 */

/**
 * The two ends of each gradient, as plain colours so the contrast test can measure the text that
 * sits on every stop. `theme-gradients.css` turns them into gradients.
 *
 * All optional, and all or none: a theme without them (Paper and Slate, by the product owner's
 * choice) stays flat. The CSS reads them with no fallback, so an absent stop makes the gradient
 * invalid and the flat colour underneath shows instead.
 */
export interface BrandGradientStops {
  /** The hero band and the final call to action, left to right. Text is `hero-ink`. */
  'hero-from': string;
  'hero-to': string;
  /** The sticky top bars. Text is `shell-ink`. */
  'shell-from': string;
  'shell-to': string;
  /** Primary buttons. Text is `on-action`. */
  'action-from': string;
  'action-to': string;
  /** Key cards: package tiers, the assistant card, the portal home cards. Text is ink and muted. */
  'card-from': string;
  'card-to': string;
  /** The Signature package card, one step richer than the other cards. Text is ink and muted. */
  'feature-from': string;
  'feature-to': string;
}

export interface BrandPalette extends Partial<BrandGradientStops> {
  /** Page background. */
  bg: string;
  /** Cards and panels that sit on the page. */
  surface: string;
  /** Badges and subtle fills. */
  soft: string;
  /** Body text. */
  ink: string;
  /** Secondary text. */
  muted: string;
  accent: string;
  /** Text placed on top of a filled accent. */
  'on-accent': string;
  /**
   * Card and input edges. Every one of these is set to the lightness that clears 3:1 against both
   * `surface` and `bg`, keeping the hue the design package chose. The package's own border values
   * sat between 1.5:1 and 2.2:1, which reads as decorative but fails the guidance for a UI
   * boundary - and a border is often the only thing saying where an input ends.
   */
  border: string;
  /** The hero panel. */
  hero: string;
  'hero-ink': string;
  /**
   * The page chrome: top bar, hero panel, accessibility toolbar and its lace. Separate from
   * `surface` because 55 badges and table headers across the app wear the surface token with dark
   * text, so the chrome cannot borrow it to go dark.
   */
  shell: string;
  'shell-ink': string;
  success: string;
  danger: string;
  shadow: string;
  /**
   * The fill of dark controls: primary buttons, checked pills, the boarding pass header. It used
   * to be `ink`, and on a dark theme ink is near white, so every one of those turned into a
   * glowing white block. Light themes use `ink`; dark themes use `accent`.
   */
  action: string;
  /** Text and icons on `action`. Light themes use `surface`; dark themes use `on-accent`. */
  'on-action': string;
  /**
   * The colour mixed into shadows. A shadow made from `ink` glows on a dark theme, so dark themes
   * use black. Light themes use `ink`, which keeps the shadow in the palette's own hue.
   */
  'shadow-tint': string;
  /** Tells the browser how to draw native controls such as date pickers and scrollbars. */
  'color-scheme': 'light' | 'dark';
}

/** Simple is the absence of a theme attribute, so it has no palette of its own. */
export const BRAND_PALETTES: Record<Exclude<BrandTheme, 'simple'>, BrandPalette> = {
  'plain-light': {
    bg: '#f6f4f1',
    surface: '#ffffff',
    soft: '#eceae6',
    ink: '#24211e',
    muted: '#57524b',
    accent: '#6b5138',
    'on-accent': '#ffffff',
    border: '#968b78',
    hero: '#efece7',
    'hero-ink': '#24211e',
    shell: '#efece7',
    'shell-ink': '#24211e',
    success: '#2f5c3a',
    danger: '#9a2f2f',
    shadow: '0 1px 2px #1a17140f',
    action: '#24211e',
    'on-action': '#ffffff',
    'shadow-tint': '#24211e',
    'color-scheme': 'light',
  },
  'plain-dark': {
    bg: '#17191c',
    surface: '#21242a',
    soft: '#2c3037',
    ink: '#f2f3f5',
    muted: '#b5bac2',
    accent: '#d8c7a8',
    'on-accent': '#23201b',
    border: '#686f7c',
    hero: '#1d2025',
    'hero-ink': '#f2f3f5',
    shell: '#1d2025',
    'shell-ink': '#f2f3f5',
    success: '#9ed3ad',
    danger: '#f2a3a3',
    shadow: '0 2px 8px #00000059',
    action: '#d8c7a8',
    'on-action': '#23201b',
    'shadow-tint': '#000000',
    'color-scheme': 'dark',
  },
  strawberry: {
    bg: '#fff7ef',
    surface: '#fffcf8',
    soft: '#f8e6e7',
    ink: '#503733',
    muted: '#785b57',
    accent: '#a33e5d',
    'on-accent': '#ffffff',
    border: '#c27b76',
    hero: '#fbf2e5',
    'hero-ink': '#503733',
    shell: '#fbf2e5',
    'shell-ink': '#503733',
    success: '#386047',
    danger: '#a02f42',
    shadow: '0 6px 0 #eddbd1, 0 16px 32px #6842390a',
    action: '#503733',
    'on-action': '#fffcf8',
    'shadow-tint': '#503733',
    'color-scheme': 'light',
    'hero-from': '#fdf3e8',
    // Cream, not pink: the hero picture fades out into this end (product owner, 30 Sep 2026).
    'hero-to': '#fdf0ea',
    'shell-from': '#fdf3e8',
    'shell-to': '#fbe4e2',
    'action-from': '#b4486d',
    'action-to': '#8a3050',
    'card-from': '#fffcf8',
    'card-to': '#fdefed',
    'feature-from': '#fff5f3',
    'feature-to': '#fbdde3',
  },
  /**
   * Milk Cream started from the solid colours Strawberry Cream shipped with. In September 2026 the
   * product owner asked for it to be milk white and gold all through, so its accent, soft ground,
   * border and card shadow moved from pink to gold. The accent is an antique gold dark enough for
   * text (5.2:1 on the page); the lighter gold is left to the picture and the frame.
   */
  'milk-cream': {
    bg: '#fff7ef',
    surface: '#fffcf8',
    soft: '#f5ead8',
    ink: '#503733',
    muted: '#785b57',
    accent: '#86621d',
    'on-accent': '#ffffff',
    border: '#a8844a',
    hero: '#fbf2e5',
    'hero-ink': '#503733',
    shell: '#fbf2e5',
    'shell-ink': '#503733',
    success: '#386047',
    danger: '#a02f42',
    shadow: '0 6px 0 #ecdfc7, 0 16px 32px #6842390a',
    action: '#503733',
    'on-action': '#fffcf8',
    'shadow-tint': '#503733',
    'color-scheme': 'light',
    'hero-from': '#fbf2e5',
    'hero-to': '#f7e3c6',
    'shell-from': '#fbf2e5',
    'shell-to': '#f9ead3',
    'action-from': '#6b4a44',
    'action-to': '#3e2a27',
    'card-from': '#fffcf8',
    'card-to': '#fbf3e6',
    'feature-from': '#fffaf1',
    'feature-to': '#f6e6cc',
  },
  moonlight: {
    bg: '#14182b',
    surface: '#22283f',
    soft: '#303750',
    ink: '#f3effd',
    muted: '#bec3dc',
    accent: '#ccbbfa',
    'on-accent': '#292139',
    border: '#687399',
    hero: '#1d2544',
    'hero-ink': '#f3effd',
    shell: '#1d2544',
    'shell-ink': '#f3effd',
    success: '#a2d5b4',
    danger: '#ffadb8',
    shadow: '0 12px 30px #070b192e',
    action: '#ccbbfa',
    'on-action': '#292139',
    'shadow-tint': '#000000',
    'color-scheme': 'dark',
    'hero-from': '#1b2240',
    'hero-to': '#34305f',
    'shell-from': '#1b2240',
    'shell-to': '#262a55',
    'action-from': '#e2d8ff',
    'action-to': '#ab9cf0',
    'card-from': '#262d48',
    'card-to': '#20263c',
    'feature-from': '#2c2f58',
    'feature-to': '#3a3266',
  },
  garden: {
    bg: '#eff5e9',
    surface: '#fcfdf6',
    soft: '#e1ecd9',
    ink: '#2e493b',
    muted: '#57705e',
    accent: '#3c644c',
    'on-accent': '#ffffff',
    border: '#739364',
    hero: '#eaf0dd',
    'hero-ink': '#263f32',
    shell: '#eaf0dd',
    'shell-ink': '#2e493b',
    success: '#356644',
    danger: '#a53340',
    shadow: '0 6px 0 #d1ddc8, 0 16px 30px #2d47320a',
    action: '#2e493b',
    'on-action': '#fcfdf6',
    'shadow-tint': '#2e493b',
    'color-scheme': 'light',
    'hero-from': '#edf3e3',
    'hero-to': '#d8e8e4',
    'shell-from': '#edf3e3',
    'shell-to': '#e0ecdf',
    'action-from': '#4b7a5d',
    'action-to': '#2e493b',
    'card-from': '#fcfdf6',
    'card-to': '#eef5ec',
    'feature-from': '#f4f9ef',
    'feature-to': '#e4f0ea',
  },
  /**
   * Royal is the package's dark emerald shell holding cream cards. The emerald lives in `shell`,
   * which only the chrome reads, so the badges and table headers on `soft` stay legible.
   */
  royal: {
    bg: '#ede0c4',
    surface: '#f8f0df',
    soft: '#e6d6b4',
    ink: '#3d3528',
    muted: '#6e624c',
    accent: '#715520',
    'on-accent': '#ffffff',
    border: '#947b48',
    hero: '#163b32',
    'hero-ink': '#f8e7c2',
    shell: '#163b32',
    'shell-ink': '#f8e7c2',
    success: '#365c42',
    danger: '#933448',
    shadow: '0 12px 30px #020e0c36',
    action: '#3d3528',
    'on-action': '#f8f0df',
    'shadow-tint': '#3d3528',
    'color-scheme': 'light',
    'hero-from': '#12322a',
    'hero-to': '#1f5243',
    'shell-from': '#12322a',
    'shell-to': '#1c4a3e',
    'action-from': '#5a4d38',
    'action-to': '#2e2719',
    'card-from': '#faf4e7',
    'card-to': '#f1e4c8',
    'feature-from': '#fbf5e8',
    'feature-to': '#f0e2c2',
  },
  /**
   * Maison Noir is black lacquer and champagne gold. Like Moonlight it is a dark theme, so filled
   * controls take the accent, their text takes `on-accent`, and shadows mix in black.
   */
  noir: {
    bg: '#110f10',
    surface: '#1a1718',
    soft: '#262122',
    ink: '#f5eee2',
    muted: '#b9ae9b',
    accent: '#d4b26a',
    'on-accent': '#1a1408',
    border: '#7a6a4d',
    hero: '#0e0c0d',
    'hero-ink': '#f5eee2',
    shell: '#0e0c0d',
    'shell-ink': '#f0e2bf',
    success: '#9fd6b0',
    danger: '#ffa39a',
    shadow: '0 24px 48px -24px #000000cc',
    action: '#d4b26a',
    'on-action': '#1a1408',
    'shadow-tint': '#000000',
    'color-scheme': 'dark',
    'hero-from': '#0e0c0d',
    'hero-to': '#1f1812',
    'shell-from': '#0e0c0d',
    'shell-to': '#1a1511',
    'action-from': '#f3e2ae',
    'action-to': '#a8803e',
    'card-from': '#1d191a',
    'card-to': '#151213',
    'feature-from': '#221d17',
    'feature-to': '#16120f',
  },
};
