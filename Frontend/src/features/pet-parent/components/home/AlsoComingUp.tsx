import { type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { usePortalCopy, usePortalLocale, type PortalLocale } from '../../i18n/portalLocale';
import type { HomePet, UpcomingStay } from '../../types/home';
import {
  daysToGoCompactLabel,
  formatCompactRange,
  joinNames,
  outstandingIssueLabel,
  prepareLink,
} from '../../utils/home';
import { STAY_STATUS_COPY } from '../stays/stayStatus';
import { HOME_COPY } from './homeCopy';
import { PetAvatarCircle } from './PetAvatarCircle';
import {
  GROUPED_CARD,
  SECTION_ACTION,
  SECTION_TITLE,
  STATUS_PILL,
  STATUS_TONE,
} from './homeStyles';

const STAYS = '/parent/stays';

// At most this many bookings after the hero show as their own row; the rest are
// reachable through "View all upcoming stays" instead of growing the homepage.
const MAX_ROWS = 2;

// Its own full-width line under the avatars and names on a phone, the third column from `sm`.
const STATUS_PLACEMENT = 'col-span-2 justify-self-start sm:col-span-1 sm:justify-self-end';

// A preparation issue comes first, because the parent can fix it. With none left, a request the
// manager has not approved yet says so rather than "All set".
function rowStatus(stay: UpcomingStay, locale: PortalLocale): { label: string; tone: string } {
  const issue = outstandingIssueLabel(stay.checklist, locale);
  if (issue) return { label: issue, tone: STATUS_TONE.attention };
  if (stay.status === 'waiting_for_review') {
    return { label: STAY_STATUS_COPY[locale].waiting_for_review, tone: STATUS_TONE.neutral };
  }
  return { label: HOME_COPY[locale].allSet, tone: STATUS_TONE.success };
}

function BookingRow({ stay, pets }: { stay: UpcomingStay; pets: HomePet[] }): ReactElement {
  const locale = usePortalLocale();
  const link = prepareLink(stay.checklist) ?? STAYS;
  const status = rowStatus(stay, locale);
  const photoByPetId = new Map(pets.map((pet) => [pet.id, pet.photoUrl]));

  // On a phone the status takes a second line across the whole row. Beside three avatars the
  // longest label ("Incomplete vaccination") is wider than what is left of a 375px screen, and it
  // would squeeze the names to nothing. From `sm` there is room for it on the right.
  return (
    <Link
      to={link}
      className="grid min-h-16 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 px-4 py-3 transition-colors hover:bg-surface-cream/60 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:px-6"
    >
      <span className="flex shrink-0 -space-x-2">
        {stay.pets.slice(0, 3).map((pet) => (
          <PetAvatarCircle
            key={pet.bookingPetId}
            name={pet.name}
            photoUrl={photoByPetId.get(pet.petId)}
            sizeClass="h-9 w-9 shrink-0 ring-2 ring-surface-card"
          />
        ))}
      </span>
      <span className="min-w-0">
        <span className="type-normal block truncate text-body">
          {joinNames(
            stay.pets.map((pet) => pet.name),
            'and',
            locale,
          )}
        </span>
        <span className="type-meta block">
          {formatCompactRange(stay.dropOffAt, stay.pickUpAt, locale)} ·{' '}
          {daysToGoCompactLabel(stay.daysToGo, locale)}
        </span>
      </span>
      <span className={`${STATUS_PILL} ${STATUS_PLACEMENT} ${status.tone}`}>{status.label}</span>
    </Link>
  );
}

// Every upcoming booking the hero does not already show, as compact rows capped
// at MAX_ROWS, with a link to the rest rather than growing the homepage further.
export function AlsoComingUpSection({
  upcomingStays,
  pets,
  heroShowsFirst,
}: {
  upcomingStays: UpcomingStay[];
  pets: HomePet[];
  /** True when the hero is the soonest upcoming stay; false when it is a stay under way. */
  heroShowsFirst: boolean;
}): ReactElement | null {
  const copy = usePortalCopy(HOME_COPY);
  const skip = heroShowsFirst ? 1 : 0;
  const additional = upcomingStays.slice(skip, skip + MAX_ROWS);
  if (additional.length === 0) return null;
  const overflow = upcomingStays.length > skip + MAX_ROWS;

  return (
    <section aria-labelledby="also-coming-up" className="flex flex-col gap-3">
      <h2 id="also-coming-up" className={SECTION_TITLE}>
        {copy.alsoComingUp}
      </h2>
      <ul className={`${GROUPED_CARD} flex-1`}>
        {additional.map((stay) => (
          <li key={stay.bookingId} className="border-b border-border-soft last:border-b-0">
            <BookingRow stay={stay} pets={pets} />
          </li>
        ))}
      </ul>
      {overflow && (
        <Link to={STAYS} className={`${SECTION_ACTION} self-start`}>
          {copy.viewAllUpcoming(upcomingStays.length)}
        </Link>
      )}
    </section>
  );
}
