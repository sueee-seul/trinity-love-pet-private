// One look for every icon button in a top bar (the chat and the bell), so they share a size, a
// stroke, a colour and the place their indicator sits. The parent portal and the staff console
// both use the bell, so both bars read as one system.

/** A 44px circle: larger than the 40px minimum hit area, and the same size as the avatar. */
export const HEADER_ICON_BUTTON =
  'relative inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-notice-muted transition-colors hover:bg-surface-card/70 hover:text-accent-foreground-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

/**
 * The open or current state. The bar is painted in `surface-deep`, which is the same colour as
 * `surface-bubbles`, so the pressed circle uses the card surface to stay visible on every theme.
 */
export const HEADER_ICON_BUTTON_ACTIVE = 'bg-surface-card text-accent-foreground';

/** The glyph box. The dot and the count are placed against its top-right corner. */
export const HEADER_ICON = 'relative inline-flex h-5 w-5';

export const HEADER_ICON_STROKE_WIDTH = 1.75;

/** "Something is going on here": an accent dot ringed in the surface colour. */
export const HEADER_ICON_DOT =
  'absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-accent-foreground ring-2 ring-surface-card';

/**
 * How many unread notices, on the same corner as the dot and small enough to leave the bell
 * readable. `header-icon-count` keeps the top bar's forced ink off it (shared/theme/brand-themes.css).
 */
export const HEADER_ICON_COUNT =
  'header-icon-count absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-status-danger px-1 type-eyebrow leading-none tracking-normal text-surface-card ring-2 ring-surface-card';
