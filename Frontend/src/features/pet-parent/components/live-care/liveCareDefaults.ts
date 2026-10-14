import type { Category } from '../../types/liveCare';

// The tint behind each activity's icon bubble. The icon itself and the entry title name the
// activity, so the tint is decoration and never the only cue.
export const BUBBLE_STYLES: Record<Category, string> = {
  potty: 'bg-surface-bubbles',
  meal: 'bg-theme-peach/60',
  solo: 'bg-surface-deep',
  play: 'bg-status-success/10',
  other: 'bg-surface-cream',
};

// The card of every timeline entry, the Photos of the day card included.
export const TIMELINE_CARD = 'mb-3 min-w-0 flex-1 rounded-2xl border bg-surface-card p-4 text-left';

// Added to a timeline card that opens photos, so it reads and behaves as a control.
export const TIMELINE_CARD_INTERACTIVE =
  'cursor-pointer transition-colors hover:border-control-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

export const TIMELINE_CHIP =
  'type-meta inline-flex items-center gap-1.5 rounded-full border border-border-soft bg-surface-card px-2.5 py-1 text-notice-secondary';
