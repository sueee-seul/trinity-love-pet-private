// Shared class strings for the pet parent pages. The homepage, Vaccination and the other portal
// pages import them, so buttons, cards, headings and status labels read as one system; see
// docs/homepage-ui-design-prompt.md §3.

// 44px tall at the least, so a finger can hit it. The press shrink only runs for visitors who
// have not asked for less motion.
export const PRIMARY_BUTTON =
  'inline-flex min-h-11 w-full items-center justify-center rounded-full bg-action-dark theme-gradient-action px-8 py-3 type-button text-on-action-dark shadow-card transition-all hover:bg-action-dark-hover motion-safe:active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-40';

export const SECONDARY_BUTTON =
  'inline-flex min-h-11 w-full items-center justify-center rounded-full border border-control-border bg-surface-card px-8 py-3 type-button text-notice-primary transition-colors hover:border-action-dark sm:w-auto sm:min-w-40';

/** Hero cards and the panels that hold a task (Feedback's question panel). */
export const INNER_PANEL = 'rounded-2xl border border-border-soft bg-surface-cream/50 p-5 sm:p-8';

/** Bordered list of rows (Feedback's rating card). */
export const GROUPED_CARD =
  'overflow-hidden rounded-2xl border border-border-soft bg-surface-card shadow-card';

/** A section's heading on a page, under the page title. The logo font has one weight. */
export const SECTION_TITLE = 'type-card-title font-normal';

/** A small label over a group of rows inside a section or card. */
export const SECTION_EYEBROW = 'type-eyebrow tracking-wider text-notice-muted';

export const SECTION_ACTION =
  'type-button inline-flex min-h-11 items-center text-accent-foreground transition-colors hover:text-accent-foreground-hover';

/**
 * A status label on a card. The words carry the status and the tone only repeats it, so it never
 * relies on colour alone.
 */
export const STATUS_PILL =
  'inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-3 py-1 type-meta font-bold';

// `accent-foreground` is only 4.48:1 on `surface-bubbles`, so text on that ground takes the darker
// hover shade (7.7:1). The other two grounds are paler and keep `accent-foreground`.
export const STATUS_TONE = {
  success: 'bg-status-success/10 text-status-success',
  attention: 'bg-theme-sun/20 text-accent-foreground',
  neutral: 'bg-surface-bubbles text-accent-foreground-hover',
} as const;

/** Rounded-square tile behind a hero icon. */
export const ICON_TILE =
  'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-bubbles text-accent-foreground lg:h-13 lg:w-13 lg:rounded-2xl';

/** A pet's photo, or their initial in Inter on a soft circle, in the darker accent for 4.5:1. */
export const AVATAR =
  'flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-bubbles type-meta font-bold text-accent-foreground-hover';
