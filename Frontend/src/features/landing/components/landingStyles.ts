// Shared class strings for the landing page. Every colour is a theme token, so the page follows every
// theme and the reading colours. Buttons use Inter at its real bold; the brand rule keeps
// semibold and medium weights off the page.

/** The page's one content width. `.landing-hero-copy` in landing.css repeats these gutters. */
export const PAGE_COLUMN = 'mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8';

/** Space between sections: loose between groups, tight inside them. */
export const SECTION = 'scroll-mt-6 py-16 sm:py-20 lg:py-28';

/** Section titles: Agbalumo has one weight, so no bold is asked of it. */
export const SECTION_TITLE =
  'theme-section-title m-0 max-w-[22ch] text-balance font-agbalumo text-[clamp(30px,4.4vw,48px)] font-normal leading-[1.1] text-notice-primary';

export const CARD_TITLE =
  'm-0 font-agbalumo text-[clamp(19px,2.4vw,22px)] font-normal leading-tight text-notice-primary';

/** Body copy names no font, so it falls back to the site's Times New Roman stack. */
export const LEAD = 'm-0 max-w-[62ch] text-[18px] leading-8 text-notice-secondary';

export const BODY = 'm-0 text-[17px] leading-7 text-notice-secondary';

const BUTTON_SHAPE =
  'inline-flex items-center justify-center gap-2 rounded-full py-2 text-center font-inter font-bold leading-tight no-underline transition-[background-color,border-color,transform] duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[.98] motion-reduce:transition-none motion-reduce:active:scale-100';

const BUTTON_BASE = `${BUTTON_SHAPE} min-h-12 px-6 text-[15px]`;

const PRIMARY_COLOURS =
  'bg-action-dark theme-gradient-action text-on-action-dark hover:bg-action-dark-hover focus-visible:outline-focus';

/** The one accent: every "Plan a stay" and every primary action. */
export const PRIMARY_BUTTON = `${BUTTON_BASE} ${PRIMARY_COLOURS}`;

/** The same action at the size the header bar has room for. */
export const PRIMARY_BUTTON_SMALL = `${BUTTON_SHAPE} min-h-11 px-4 text-[14px] ${PRIMARY_COLOURS}`;

export const SECONDARY_BUTTON = `${BUTTON_BASE} border border-control-border bg-surface-card text-notice-primary hover:border-accent-foreground focus-visible:outline-focus`;

/**
 * A quiet button straight on the hero colour. It takes the hero ink for text, edge and focus ring,
 * because the accent and focus colours are measured against the page, not the band (Royal's band
 * is emerald).
 */
export const HERO_OUTLINE_BUTTON = `${BUTTON_BASE} border border-hero-ink/50 text-hero-ink hover:border-hero-ink focus-visible:outline-hero-ink`;

export const TEXT_LINK =
  'inline-flex min-h-11 items-center rounded-full font-inter text-[15px] font-bold text-accent-foreground underline decoration-1 underline-offset-4 hover:decoration-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

/** A link or button on the hero colour: hero ink, always underlined, with a hero ink ring. */
export const HERO_TEXT_LINK =
  'inline-flex min-h-11 items-center rounded-full px-2 font-inter text-[14px] font-bold text-hero-ink underline decoration-1 underline-offset-4 hover:decoration-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hero-ink';

/** Photographs: the frame sets the ratio, the picture fills it and is cropped. */
export const PHOTO = 'block h-full w-full object-cover';

export const CARD =
  'rounded-[28px] border border-border-soft bg-surface-card shadow-[0_1px_2px_color-mix(in_srgb,var(--color-shadow-tint)_5%,transparent),0_18px_48px_-28px_color-mix(in_srgb,var(--color-shadow-tint)_24%,transparent)]';
