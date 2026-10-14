import type { ReactElement } from 'react';
import type { UpdatePetProfileInput } from '../../api/petApi';
import type { Pet } from '../../types/pet';
import { PetProfileDetailsPanel } from './PetProfileDetailsPanel';

type PetDashboardHeaderProps = {
  pet: Pet;
  showDetails: boolean;
  onToggleDetails: () => void;
  onSaveProfile: (input: UpdatePetProfileInput) => Promise<void>;
};

const formatAge = (age: number): string => `${age} yr${age === 1 ? '' : 's'} old`;

export function PetDashboardHeader({
  pet,
  showDetails,
  onToggleDetails,
  onSaveProfile,
}: PetDashboardHeaderProps): ReactElement {
  return (
    <header className="relative flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border-soft bg-surface-card px-4 py-3 shadow-card sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-surface-cream type-card-title font-bold text-notice-secondary">
          {pet.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="type-display text-notice-primary">
            {pet.name}{' '}
            <span className="ml-1 type-meta font-normal text-notice-secondary">
              Owner: <b>{pet.ownerName}</b>
            </span>
          </h1>
          <p className="type-meta text-notice-secondary">
            {pet.type} <span className="px-1">•</span> {formatAge(pet.age)}{' '}
            <span className="px-1">•</span> {pet.gender}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden text-right type-meta font-semibold text-notice-secondary sm:block">
          <p className="type-body">Check-in: {pet.checkInDate}</p>
          <p className="font-normal">Check-out: {pet.checkOutDate ?? 'Not yet scheduled'}</p>
        </div>
        <button
          type="button"
          onClick={onToggleDetails}
          aria-label={showDetails ? 'Collapse pet profile details' : 'Expand pet profile details'}
          aria-expanded={showDetails}
          aria-controls="pet-profile-details"
          className="rounded-lg bg-surface-cream px-3 py-2 type-body font-semibold text-notice-secondary transition hover:bg-surface-deep"
        >
          <span aria-hidden="true">{showDetails ? '⌃' : '⌄'}</span>
        </button>
      </div>
      {showDetails && (
        <div id="pet-profile-details" className="order-3 w-full border-t border-border-soft pt-3">
          <PetProfileDetailsPanel pet={pet} onSave={onSaveProfile} />
        </div>
      )}
    </header>
  );
}
