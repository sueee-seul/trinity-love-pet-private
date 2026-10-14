// The class strings the stay dialogs share, so each dialog reads like the others.

export const DIALOG_INTRO = 'm-0 text-[13.5px] leading-6 text-notice-secondary';

export const DIALOG_LABEL = 'text-[12.5px] font-semibold text-notice-primary';

export const DIALOG_HINT = 'm-0 mt-1 text-[12px] text-notice-muted';

/** A native input (time, select) drawn like the shared date field. */
export const DIALOG_INPUT =
  'w-full min-h-11 rounded-lg border border-field-border bg-surface-card px-4 py-2 text-body text-notice-primary focus:outline-hidden focus:ring-2 focus:ring-focus';

/** The box that shows what was checked: dates, nights, amounts. */
export const DIALOG_SUMMARY = 'mt-4 rounded-xl bg-surface-cream px-3 py-2.5 text-[13px] leading-5';

export const DIALOG_ALERT = 'm-0 mt-4 text-[13px] font-semibold text-status-danger';

export const DIALOG_SECONDARY_BUTTON =
  'rounded-full border border-border-soft px-4 py-2 text-[13px] font-semibold text-notice-primary hover:bg-surface-cream';

export const DIALOG_PRIMARY_BUTTON =
  'rounded-full bg-action-dark theme-gradient-action px-4 py-2 text-[13px] font-semibold text-on-action-dark disabled:opacity-50';
