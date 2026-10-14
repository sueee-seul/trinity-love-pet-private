import React, { useId } from 'react';
import type { Pet } from '../../../pet-parent/types/booking';
import type { ConciergeCopy } from '../../copy';
import { useAccountPetsStore } from '../../store/accountPets';
import { selectAssistantThinking, useConciergeStore } from '../../store/conciergeStore';
import { savedPetChoices } from '../../store/savedPetLinks';
import { normaliseSpecies } from '../../utils/species';
import { CARD_TITLE, SURFACE_CARD } from '../conciergeStyles';

/**
 * "Who's staying?" for signed-in owners: their saved pets as tap buttons, so a repeat stay is
 * pick pets, pick dates, continue with a stay. A chosen pet is linked to its saved record and brings
 * what the account knows (an earlier stay, medication on file), so the details step asks nothing
 * more about it and no duplicate pet (with a duplicate vaccination task) is made.
 */

export const SavedPetChips: React.FC<{ copy: ConciergeCopy }> = ({ copy }) => {
  const pets = useAccountPetsStore((state) => state.pets);
  const savedPetLinks = useConciergeStore((state) => state.savedPetLinks);
  const applySavedPets = useConciergeStore((state) => state.applySavedPets);
  const thinking = useConciergeStore(selectAssistantThinking);
  const titleId = useId();

  if (pets.length === 0) return null;

  const toggle = (pet: Pet): void => {
    const chosenIds = savedPetLinks.filter((link): link is string => link !== null);
    const nextIds = chosenIds.includes(pet.id)
      ? chosenIds.filter((id) => id !== pet.id)
      : [...chosenIds, pet.id];
    applySavedPets(savedPetChoices(nextIds, pets));
  };

  return (
    <section aria-labelledby={titleId} className={`${SURFACE_CARD} p-5`}>
      <h2 id={titleId} className={CARD_TITLE}>
        {copy.answers.savedPetsTitle}
      </h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {pets.map((pet) => {
          const chosen = savedPetLinks.includes(pet.id);
          return (
            <button
              key={pet.id}
              type="button"
              aria-pressed={chosen}
              disabled={thinking}
              onClick={() => toggle(pet)}
              className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 type-body font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                chosen
                  ? 'border-action-dark bg-action-dark text-on-action-dark'
                  : 'border-control-border bg-surface-card text-notice-primary hover:bg-surface-cream'
              }`}
            >
              <span aria-hidden="true">{chosen ? '✓' : '+'}</span>
              {pet.name}
              <span className="font-normal opacity-80">
                · {copy.checklist[normaliseSpecies(pet.species)]}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
};
