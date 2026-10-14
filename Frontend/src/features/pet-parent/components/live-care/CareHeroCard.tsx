import type { ReactElement } from 'react';
import { usePortalCopy } from '../../i18n/portalLocale';
import type { StayStatus } from '../../types/stays';
import { PetAvatarCircle } from '../home/PetAvatarCircle';
import { StatusBadge } from '../stays/StatusBadge';
import { LIVE_CARE_COPY, type LiveCareCopy } from './liveCareCopy';
import type { StayPhase } from './liveCareStatus';

interface CareHeroCardProps {
  petName: string;
  petPhotoUrl?: string;
  sitterName: string | null;
  location: string | null;
  phase: StayPhase;
}

// The same badges and words as My stays: once the pet has gone home the page is a record, so it
// says the stay has ended instead of calling itself live. An approved stay that has not begun
// says "Not started" (the hero copy), since this page is about care rather than the booking. The
// other two keep the badge's own words, so one stay is never called two things.
const PHASE_BADGE_STATUS: Record<StayPhase, StayStatus> = {
  upcoming: 'approved',
  'in-progress': 'staying_now',
  ended: 'stay_ended',
};

// With nobody rostered onto the pet yet, the team is looking after it, so the page says that
// instead of naming a person or a place.
function careLineFor(
  copy: LiveCareCopy['hero'],
  phase: StayPhase,
  sitterName: string | null,
): string {
  const ended = phase === 'ended';
  if (sitterName === null) return ended ? copy.stayedWithTeam : copy.boardingWithTeam;
  return ended ? copy.stayedWith(sitterName) : copy.boardingWith(sitterName);
}

/** Who is looking after the pet and where, with the stay's phase. The pet's name is already in
 * the page title, so this card is about the stay rather than the pet. */
export function CareHeroCard({
  petName,
  petPhotoUrl,
  sitterName,
  location,
  phase,
}: CareHeroCardProps): ReactElement {
  const copy = usePortalCopy(LIVE_CARE_COPY).hero;
  const careLine = careLineFor(copy, phase, sitterName);
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-border-soft bg-surface-card p-4 shadow-card sm:p-5">
      {/* The page title already names the pet, so the photo or initial is decoration here. */}
      <span aria-hidden="true">
        <PetAvatarCircle
          name={petName}
          photoUrl={petPhotoUrl}
          sizeClass="h-14 w-14 text-card-title"
        />
      </span>
      <div className="min-w-0 flex-1">
        <p className="type-body m-0 font-bold">{careLine}</p>
        {location && <p className="type-meta m-0 mt-0.5">{location}</p>}
      </div>
      <StatusBadge
        status={PHASE_BADGE_STATUS[phase]}
        label={phase === 'upcoming' ? copy.notStarted : undefined}
      />
    </div>
  );
}
