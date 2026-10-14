import type { PetStay } from '../../types/stays';
import { canAddOn, canChangeTimes, canExtendOnline } from './stayChangeRules';

/** The dialogs My stays opens to change a stay. */
export type StayDialogKind = 'cancel' | 'move' | 'extend' | 'add-on' | 'times';

export interface OpenStayDialog {
  kind: StayDialogKind;
  stay: PetStay;
}

// The in-stay dialogs a link from elsewhere (`?open=extend&stay=...`) may open, and the rule each
// must pass first, so a stale link never opens a dialog the server would refuse.
const URL_DIALOGS: Readonly<
  Record<string, [StayDialogKind, (stay: PetStay, now: Date) => boolean]>
> = {
  extend: ['extend', canExtendOnline],
  'add-on': ['add-on', canAddOn],
  times: ['times', canChangeTimes],
};

/** The dialog an `?open=` value names for `stay`, or null when there is none or it does not apply. */
export const dialogFromUrl = (
  open: string | null,
  stay: PetStay | undefined,
  now: Date = new Date(),
): OpenStayDialog | null => {
  const entry = open === null ? undefined : URL_DIALOGS[open];
  if (!entry || !stay) return null;
  const [kind, allowed] = entry;
  return allowed(stay, now) ? { kind, stay } : null;
};
