import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { useMyStays } from '../../components/live-care/useMyStays';
import { IN_STAY_CHANGES_COPY } from '../../components/stays/inStayChangesCopy';
import { canExtendOnline } from '../../components/stays/stayChangeRules';
import { usePortalCopy } from '../../i18n/portalLocale';

const MY_STAYS_PATH = '/parent/stays';

type QuickAction = 'extend' | 'addOn';

/** The `?open=` value My stays reads, and the label of the link that carries it. */
const QUICK_ACTIONS: readonly { open: string; label: QuickAction }[] = [
  { open: 'extend', label: 'extend' },
  { open: 'add-on', label: 'addOn' },
];

const ACTION_CLASS =
  'type-button inline-flex min-h-11 items-center text-notice-primary underline underline-offset-2';

interface StayQuickActionsProps {
  now?: Date;
  /**
   * Says the request in the chat, where the assistant prices it and makes it once the parent
   * confirms. Without it each action opens its dialog on My stays instead.
   */
  onAsk?: (message: string) => void;
}

/**
 * While a pet is staying, the chat page offers the two changes a parent most often asks for.
 * On the chat page each one asks the assistant, which quotes the price and waits for a yes; a link
 * to My stays stays beside them for a parent who prefers the dialogs. Nothing changes from here.
 */
export function StayQuickActions({
  now = new Date(),
  onAsk,
}: StayQuickActionsProps): ReactElement | null {
  const { links, quickActions: copy } = usePortalCopy(IN_STAY_CHANGES_COPY);
  const { stays, status } = useMyStays();
  const stay =
    status === 'loaded' ? stays.find((candidate) => canExtendOnline(candidate, now)) : null;
  if (!stay) return null;

  return (
    <nav
      aria-label={copy.label}
      className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-1 rounded-2xl border border-border-soft bg-surface-card px-4 py-2 shadow-card"
    >
      <p className="type-meta m-0 mr-auto">{copy.lead(stay.pet.name)}</p>
      {onAsk ? (
        <>
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.open}
              type="button"
              onClick={() => onAsk(copy.asks[action.label](stay.pet.name))}
              className={ACTION_CLASS}
            >
              {links[action.label]}
            </button>
          ))}
          <Link to={MY_STAYS_PATH} className={ACTION_CLASS}>
            {copy.openMyStays}
          </Link>
        </>
      ) : (
        QUICK_ACTIONS.map((action) => (
          <Link
            key={action.open}
            to={`${MY_STAYS_PATH}?open=${action.open}&stay=${encodeURIComponent(stay.bookingPetId)}`}
            className={ACTION_CLASS}
          >
            {links[action.label]}
          </Link>
        ))
      )}
    </nav>
  );
}
