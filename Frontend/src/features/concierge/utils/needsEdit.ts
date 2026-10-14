import {
  CONCIERGE_MAX_PETS,
  type ConciergeExtras,
  type ConciergeNeeds,
  type ConciergePetNeed,
  type ConciergeSpecies,
} from '../types';

/**
 * Small, pure edits to the needs, shared by the stay card, the extras and the answer buttons so
 * all of them change the plan in exactly the same way. Pets have no id before checkout: position
 * is their identity.
 */

export const emptyPet = (species: ConciergeSpecies | null = null): ConciergePetNeed => ({
  species,
  size: null,
  needsMedication: null,
  firstTimeBoarding: null,
});

export const withPetCount = (needs: ConciergeNeeds, count: number): ConciergeNeeds => {
  const target = Math.min(Math.max(count, 0), CONCIERGE_MAX_PETS);
  return {
    ...needs,
    service: needs.service ?? 'boarding',
    pets:
      target <= needs.pets.length
        ? needs.pets.slice(0, target)
        : [...needs.pets, ...Array.from({ length: target - needs.pets.length }, () => emptyPet())],
  };
};

/** Replaces the pet list with these species, keeping what is known about pets that stay. */
export const withPetSpecies = (
  needs: ConciergeNeeds,
  species: ConciergeSpecies[],
): ConciergeNeeds => ({
  ...needs,
  service: needs.service ?? 'boarding',
  pets: species.slice(0, CONCIERGE_MAX_PETS).map((kind, index) => {
    const existing = needs.pets[index];
    return existing && existing.species === kind ? existing : emptyPet(kind);
  }),
});

export const withPet = (
  needs: ConciergeNeeds,
  index: number,
  change: Partial<ConciergePetNeed>,
): ConciergeNeeds => ({
  ...needs,
  pets: needs.pets.map((pet, petIndex) => (petIndex === index ? { ...pet, ...change } : pet)),
});

/**
 * Answers the medication question for the pets it asked about (by position): those in `taking`
 * need it, the others asked about do not. A pet that was not asked about keeps its answer, so a
 * saved pet's medication on record is never wiped by a tap about another pet.
 */
export const withMedicationFor = (
  needs: ConciergeNeeds,
  asked: number[],
  taking: number[],
): ConciergeNeeds => ({
  ...needs,
  pets: needs.pets.map((pet, index) =>
    asked.includes(index) ? { ...pet, needsMedication: taking.includes(index) } : pet,
  ),
});

export const withExtra = (
  needs: ConciergeNeeds,
  extra: keyof ConciergeExtras,
  wanted: boolean,
): ConciergeNeeds => ({ ...needs, extras: { ...needs.extras, [extra]: wanted } });

export const withDates = (
  needs: ConciergeNeeds,
  startDate: string | null,
  endDate: string | null,
): ConciergeNeeds => ({
  ...needs,
  service: needs.service ?? 'boarding',
  startDate,
  endDate,
});
