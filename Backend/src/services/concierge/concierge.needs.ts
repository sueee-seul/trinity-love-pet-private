import {
  CONCIERGE_MAX_PETS,
  CONCIERGE_MAX_STAY_NIGHTS,
  type ConciergeExtras,
  type ConciergeNeedField,
  type ConciergeNeeds,
  type ConciergePetNeed,
} from '../../contracts/concierge.contract.js';
import { nightsBetween } from '../booking.pricing.js';

/**
 * The structured half of a concierge conversation.
 *
 * Needs arrive from three places - the tick-box checklist, the rules assistant and the model's
 * `record_booking_needs` tool - and all of them go through `mergeNeeds`, so there is one place that
 * decides what a partial update means and one place (`missingNeedFields`) that decides whether the
 * concierge has enough to quote.
 */

export const EMPTY_EXTRAS: ConciergeExtras = { walks: false, grooming: false, playtime: false };

export const createEmptyNeeds = (): ConciergeNeeds => ({
  service: null,
  startDate: null,
  endDate: null,
  pets: [],
  extras: { ...EMPTY_EXTRAS },
  notes: '',
});

export const createEmptyPet = (): ConciergePetNeed => ({
  species: null,
  size: null,
  needsMedication: null,
  firstTimeBoarding: null,
});

/** A change to one pet, by position; any field left out keeps its current value. */
export interface ConciergePetChange {
  index: number;
  name?: string | undefined;
  species?: ConciergePetNeed['species'] | undefined;
  size?: ConciergePetNeed['size'] | undefined;
  needsMedication?: boolean | null | undefined;
  firstTimeBoarding?: boolean | null | undefined;
}

/** A partial update: any field left out keeps its current value. */
export interface ConciergeNeedsPatch {
  service?: ConciergeNeeds['service'] | undefined;
  startDate?: string | null | undefined;
  endDate?: string | null | undefined;
  /** Grows or shrinks the pet list; new pets start empty. */
  petCount?: number | undefined;
  /** Per-pet changes keyed by position in the pet list. */
  pets?: ConciergePetChange[] | undefined;
  extras?:
    | {
        walks?: boolean | undefined;
        grooming?: boolean | undefined;
        playtime?: boolean | undefined;
      }
    | undefined;
  notes?: string | undefined;
}

const MAX_NOTES_LENGTH = 500;

const resizePets = (pets: ConciergePetNeed[], petCount: number): ConciergePetNeed[] => {
  const target = Math.min(Math.max(Math.trunc(petCount), 0), CONCIERGE_MAX_PETS);
  if (target <= pets.length) {
    return pets.slice(0, target);
  }
  return [...pets, ...Array.from({ length: target - pets.length }, createEmptyPet)];
};

const applyPetChange = (base: ConciergePetNeed, change: ConciergePetChange): ConciergePetNeed => {
  const name = change.name ?? base.name;
  return {
    species: change.species !== undefined ? change.species : base.species,
    size: change.size !== undefined ? change.size : base.size,
    needsMedication:
      change.needsMedication !== undefined ? change.needsMedication : base.needsMedication,
    firstTimeBoarding:
      change.firstTimeBoarding !== undefined ? change.firstTimeBoarding : base.firstTimeBoarding,
    ...(name !== undefined ? { name } : {}),
  };
};

const applyPetChanges = (
  pets: ConciergePetNeed[],
  changes: ConciergePetChange[],
): ConciergePetNeed[] => {
  const next = pets.map((pet) => ({ ...pet }));
  for (const change of changes) {
    const { index } = change;
    if (!Number.isInteger(index) || index < 0 || index >= CONCIERGE_MAX_PETS) {
      continue;
    }
    while (next.length <= index) {
      next.push(createEmptyPet());
    }
    next[index] = applyPetChange(next[index] ?? createEmptyPet(), change);
  }
  return next;
};

const mergeExtras = (
  current: ConciergeExtras,
  change: ConciergeNeedsPatch['extras'],
): ConciergeExtras => ({
  walks: change?.walks ?? current.walks,
  grooming: change?.grooming ?? current.grooming,
  playtime: change?.playtime ?? current.playtime,
});

export const mergeNeeds = (current: ConciergeNeeds, patch: ConciergeNeedsPatch): ConciergeNeeds => {
  let pets = current.pets;
  if (patch.petCount !== undefined) {
    pets = resizePets(pets, patch.petCount);
  }
  if (patch.pets) {
    pets = applyPetChanges(pets, patch.pets);
  }

  return {
    service: patch.service !== undefined ? patch.service : current.service,
    startDate: patch.startDate !== undefined ? patch.startDate : current.startDate,
    endDate: patch.endDate !== undefined ? patch.endDate : current.endDate,
    pets,
    extras: mergeExtras(current.extras, patch.extras),
    notes: (patch.notes ?? current.notes).slice(0, MAX_NOTES_LENGTH),
  };
};

/** Today's calendar date in New Zealand, where the facility is. */
export const todayInNewZealand = (now: Date = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland' }).format(now);

/**
 * Dates count only when they make a bookable stay: start today or later, end after start, and no
 * longer than the facility takes bookings for. An impossible range is treated as missing so the
 * concierge asks again instead of quoting nonsense.
 */
export const hasBookableDates = (needs: ConciergeNeeds, today: string): boolean => {
  const { startDate, endDate } = needs;
  if (!startDate || !endDate) {
    return false;
  }
  if (startDate < today || endDate <= startDate) {
    return false;
  }
  return nightsBetween(startDate, endDate) <= CONCIERGE_MAX_STAY_NIGHTS;
};

export const missingNeedFields = (
  needs: ConciergeNeeds,
  today: string = todayInNewZealand(),
): ConciergeNeedField[] => {
  const missing: ConciergeNeedField[] = [];
  if (!needs.service) missing.push('service');
  if (!hasBookableDates(needs, today)) missing.push('dates');
  if (needs.pets.length === 0) {
    missing.push('pets');
  } else {
    if (needs.pets.some((pet) => pet.species === null)) missing.push('species');
  }
  return missing;
};

/**
 * Details worth asking for but never worth holding the price back for. A dog's size does not
 * change any price today (the catalogue has no size data), so the options appear without it; it is
 * still asked once, because staff use it to choose the room.
 */
export const optionalNeedFields = (needs: ConciergeNeeds): ConciergeNeedField[] =>
  needs.pets.some((pet) => pet.species === 'dog' && pet.size === null) ? ['size'] : [];

export const isReadyToQuote = (needs: ConciergeNeeds, today?: string): boolean =>
  missingNeedFields(needs, today).length === 0;
