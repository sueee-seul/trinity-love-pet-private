// Shared class strings for the concierge page. Every colour is a semantic token, so the page
// follows whichever brand theme is active. Shadows mix from the shadow tint rather than the ink:
// on a dark theme the ink is near white, and a shadow made from it glows instead of darkening.
// Text on the dark fill uses its own on-action-dark token for the same reason, because the fill
// turns light on a dark theme and card-coloured text on it would disappear.
//
// Sizes come from the type roles in index.css (type-body, type-meta, type-eyebrow, type-button,
// type-card-title), which the page's `parent-type-scale` sets to the customer sizes. A role also
// names Inter, so a label never falls back to the page's Times New Roman by accident.

/** A section card. `shadow-card` follows the theme (brand-themes.css gives each its own). */
export const SURFACE_CARD = 'rounded-2xl border border-border-soft bg-surface-card shadow-card';

/** Card and section titles: the logo font, which has one weight, so it is never asked for bold. */
export const CARD_TITLE = 'm-0 type-card-title font-normal';

/** A group title inside a form, such as "About you" or "Your pets". */
export const GROUP_LEGEND = 'mb-3 type-card-title font-normal';

export const PRIMARY_BUTTON =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-action-dark theme-gradient-action px-6 type-button text-on-action-dark transition-[background-color,transform] duration-200 ease-out hover:bg-action-dark-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50';

export const SECONDARY_BUTTON =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-border-soft bg-surface-card px-6 type-button text-notice-primary transition-[border-color,background-color] duration-200 ease-out hover:border-control-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50';

const TEXT_BUTTON_LOOK =
  'rounded-full type-button text-accent-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

/**
 * A text button that sits straight on the /book hero band. It takes the band's ink, and its focus
 * ring uses the same ink, because the accent and focus colours are measured against the page and
 * card, not against the band (Royal's band is emerald). With link and text in one colour the
 * underline is what marks it as a control, so it is always drawn, not only on hover.
 */
const HERO_BAND_TEXT_BUTTON_LOOK =
  'rounded-full type-button text-hero-ink underline decoration-1 underline-offset-4 hover:decoration-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hero-ink';

/** A text button on its own line, with a 44px touch target. */
export const TEXT_BUTTON = `inline-flex min-h-11 items-center gap-1 px-2 ${TEXT_BUTTON_LOOK}`;

export const HERO_BAND_TEXT_BUTTON = `inline-flex min-h-11 items-center gap-1 px-2 ${HERO_BAND_TEXT_BUTTON_LOOK}`;

/**
 * A 44px tall tap area drawn by an invisible pseudo-element centred on the text. The button keeps
 * the line's own height, so the sentence is not pushed apart, yet a thumb still has a 44px target,
 * as every other control on these pages does.
 */
const INLINE_HIT_AREA =
  "relative after:absolute after:-inset-x-1 after:top-1/2 after:h-11 after:-translate-y-1/2 after:content-['']";

/** A text button inside a sentence. The caller sets the sentence's size. */
export const INLINE_TEXT_BUTTON = `inline p-0 ${INLINE_HIT_AREA} ${TEXT_BUTTON_LOOK}`;

export const HERO_BAND_INLINE_TEXT_BUTTON = `inline p-0 ${INLINE_HIT_AREA} ${HERO_BAND_TEXT_BUTTON_LOOK}`;

/**
 * The focus state every text field shares: a solid 2px ring in the focus colour, joined to a
 * border of the same colour. A pale glow is easy to miss; a peach one measured about 1.2:1 on the
 * card. `outline-hidden` rather than `outline-none` keeps a system outline in forced colours mode,
 * where box shadows (and so the ring) are not drawn.
 */
export const FIELD_FOCUS =
  'focus-visible:border-focus focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus';

/**
 * The field look without a display class. The shared date trigger lays itself out as inline-flex
 * to hold its calendar icon, and a `block` here would fight it with no clear winner. The body role
 * is 16px on these pages, so iOS never zooms into a focused field.
 */
export const FIELD_BOX = `w-full min-w-0 rounded-2xl border border-field-border bg-surface-card px-4 py-3 type-body text-notice-primary placeholder:text-notice-muted transition-[border-color,box-shadow] duration-200 ${FIELD_FOCUS} aria-[invalid=true]:border-status-danger`;

export const FIELD = `block ${FIELD_BOX}`;

/**
 * The time select. The shared field draws its own chevron, so the browser arrow is hidden and
 * the right padding leaves room for the chevron.
 */
export const TIME_FIELD = `${FIELD} appearance-none pr-10`;

export const FIELD_LABEL = 'mb-1.5 block type-meta font-semibold text-notice-primary';

export const HELP_TEXT = 'mt-1.5 mb-0 type-meta';

/** A small uppercase label over a value or a group, such as "Total". */
export const EYEBROW = 'm-0 type-eyebrow tracking-[0.16em] text-notice-muted';

/** Checkbox and radio controls sized for touch (44px row), with the brand accent. */
export const CHECK_ROW =
  'flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl px-1 py-2 type-body text-notice-primary';

export const CHECKBOX =
  'mt-1 h-5 w-5 flex-shrink-0 cursor-pointer accent-[var(--color-action-dark)]';

export const ERROR_TEXT = 'm-0 type-meta text-status-danger';
