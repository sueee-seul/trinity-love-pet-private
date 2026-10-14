import type { ConciergeCopy } from '../copy';
import type { ConciergeExtras } from '../types';

/** The extras a guest can ask the assistant for, in the order every list on the page shows them. */
export const EXTRA_KEYS: ReadonlyArray<keyof ConciergeExtras> = ['walks', 'grooming', 'playtime'];

/** The names of the extras the guest asked for, in the page's language. */
export const chosenExtraLabels = (copy: ConciergeCopy, extras: ConciergeExtras): string[] =>
  EXTRA_KEYS.filter((key) => extras[key]).map((key) => copy.extras[key]);
