import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { usePortalCopy } from '../../i18n/portalLocale';
import type { PetStay } from '../../types/stays';
import { PetAvatarCircle } from '../home/PetAvatarCircle';
import { LIVE_CARE_COPY } from './liveCareCopy';

interface PetSwitcherProps {
  /** The parent's stays under way now, one choice each. */
  stays: PetStay[];
  /** The stay on screen, marked as the current page. */
  currentBookingPetId: string;
}

/**
 * One choice per pet staying with us now, so a parent with two pets on the same stay can move
 * between their updates. Rendered only when there is more than one pet to choose from.
 */
export function PetSwitcher({ stays, currentBookingPetId }: PetSwitcherProps): ReactElement | null {
  const copy = usePortalCopy(LIVE_CARE_COPY);
  if (stays.length < 2) return null;

  return (
    <nav aria-label={copy.petSwitcher}>
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {stays.map((stay) => {
          const isCurrent = stay.bookingPetId === currentBookingPetId;
          return (
            <li key={stay.bookingPetId}>
              <Link
                to={`/parent/live-care/${stay.bookingPetId}`}
                aria-current={isCurrent ? 'page' : undefined}
                className={`type-button inline-flex min-h-11 items-center gap-2 rounded-full border py-1 pl-1 pr-4 transition-colors ${
                  isCurrent
                    ? 'border-accent-foreground bg-surface-bubbles text-notice-primary'
                    : 'border-border-soft bg-surface-card text-notice-secondary hover:border-control-border hover:text-notice-primary'
                }`}
              >
                {/* The name follows, so the initial must not be read as part of the link. */}
                <span aria-hidden="true">
                  <PetAvatarCircle
                    name={stay.pet.name}
                    photoUrl={stay.pet.photoUrl}
                    sizeClass="h-9 w-9"
                  />
                </span>
                {stay.pet.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
