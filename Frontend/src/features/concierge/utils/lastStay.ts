import type { ConciergeLastStay } from '../types';
import type { PlanPetLinks } from '../store/savedPetLinks';

/**
 * The saved-pet links a copied earlier stay brings. Each copied pet is tied to its saved profile
 * by id, exactly as a tapped pet chip does, so checkout books that saved pet instead of creating
 * it again. A pet deleted since that stay has no profile and is left unlinked; the parent names
 * it on the details step as a guest would.
 */
export const linksFromLastStay = (
  lastStay: ConciergeLastStay,
): Pick<PlanPetLinks, 'links' | 'savedPets'> => {
  const links = lastStay.needs.pets.map((_, index) => lastStay.savedPetIds[index] ?? null);
  const savedPets: PlanPetLinks['savedPets'] = {};
  lastStay.needs.pets.forEach((pet, index) => {
    const id = links[index];
    // A link only survives reconciling when the plan knows the pet's name and kind.
    if (id && pet.species !== null) savedPets[id] = { name: pet.name ?? '', species: pet.species };
  });
  return { links, savedPets };
};
