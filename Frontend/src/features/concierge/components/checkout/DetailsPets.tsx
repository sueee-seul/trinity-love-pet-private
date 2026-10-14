import React, { useEffect, useRef } from 'react';
import type { Pet } from '../../../pet-parent/types/booking';
import type { ConciergeCopy } from '../../copy';
import { useAccountPetsStore } from '../../store/accountPets';
import { useConciergeStore } from '../../store/conciergeStore';
import type { ConciergePetNeed } from '../../types';
import { predictReviewReasons } from '../../utils/reviewReasons';
import { normaliseSpecies } from '../../utils/species';
import {
  MAX_LENGTHS,
  petBreedKey,
  petNameKey,
  type DetailsPetDraft,
} from '../../utils/validateDetails';
import { GROUP_LEGEND, TEXT_BUTTON } from '../conciergeStyles';
import { PetSourcePicker, TextField } from './DetailsFields';

interface DetailsPetsProps {
  copy: ConciergeCopy;
  /** The agreed plan's pets, which say what each row is (kind, size, medication). */
  petNeeds: ConciergePetNeed[];
  pets: DetailsPetDraft[];
  visibleError: (key: string) => string | null;
  touch: (key: string) => () => void;
  onChange: (index: number, change: Partial<DetailsPetDraft>) => void;
}

const petHeading = (
  copy: ConciergeCopy,
  index: number,
  pet: ConciergePetNeed | undefined,
): string => {
  const parts = [copy.checklist.petLabel(index)];
  if (pet?.species) parts.push(copy.checklist[pet.species]);
  if (pet?.size) parts.push(copy.checklist[pet.size]);
  if (pet?.needsMedication) parts.push(copy.stay.medication);
  if (pet?.firstTimeBoarding) parts.push(copy.stay.firstStay);
  return parts.join(' · ');
};

/** A saved pet is offered only for a pet of the same kind (or when either kind is unclear). */
const sameKind = (pet: Pet, species: ConciergePetNeed['species'] | undefined): boolean => {
  const saved = normaliseSpecies(pet.species);
  return !species || species === 'other' || saved === 'other' || saved === species;
};

/**
 * "Your pets" on the details step. A pet already linked to one of the account's saved pets (a
 * tapped chip, a name matched in the chat, a pet's "Book a stay" link) is shown read-only with
 * Change, so nothing about it is asked again. Only a pet that is not linked yet offers the saved
 * pets of its kind, or a name and breed for a new pet.
 *
 * A pet that takes medication carries a line saying our manager checks its stay before confirming
 * it, so the guest knows before sending which stays wait.
 */
export const DetailsPets: React.FC<DetailsPetsProps> = ({
  copy,
  petNeeds,
  pets,
  visibleError,
  touch,
  onChange,
}) => {
  const accountPets = useAccountPetsStore((state) => state.pets);
  const linkedNames = useConciergeStore((state) => state.savedPets);
  const { details } = copy;
  const listRef = useRef<HTMLFieldSetElement>(null);
  /** The row whose Change was pressed: its first field takes the focus the button leaves. */
  const rowToFocus = useRef<number | null>(null);

  useEffect(() => {
    const row = rowToFocus.current;
    if (row === null) return;
    rowToFocus.current = null;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-pet-row="${row}"] select, [data-pet-row="${row}"] input`)
      ?.focus();
  });

  const nameOf = (petId: string, typedName: string): string =>
    accountPets.find((pet) => pet.id === petId)?.name ?? linkedNames[petId]?.name ?? typedName;

  // A saved pet already chosen for another row is not offered again (checkout books it once).
  const choicesFor = (index: number): Pet[] =>
    accountPets.filter(
      (pet) =>
        sameKind(pet, petNeeds[index]?.species) &&
        !pets.some((row, rowIndex) => rowIndex !== index && row.existingPetId === pet.id),
    );

  return (
    <fieldset ref={listRef} className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0">
      <legend className={GROUP_LEGEND}>{details.petsTitle}</legend>
      {pets.map((pet, index) => {
        const choices = choicesFor(index);
        const reasons = predictReviewReasons(petNeeds[index]);
        return (
          <div
            // eslint-disable-next-line react/no-array-index-key -- pets have no id before checkout and are only added or removed at the end, so position is their identity.
            key={`pet-${index}`}
            data-pet-row={index}
            className="flex min-w-0 flex-col gap-3 rounded-2xl border border-border-soft p-4"
          >
            <p className="m-0 type-eyebrow tracking-[0.14em] text-notice-muted">
              {petHeading(copy, index, petNeeds[index])}
            </p>
            {pet.existingPetId ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="m-0 type-body font-semibold text-notice-primary [overflow-wrap:anywhere]">
                    {nameOf(pet.existingPetId, pet.name)}
                  </p>
                  <p className="m-0 type-meta text-notice-secondary">{details.savedPetNote}</p>
                </div>
                <button
                  type="button"
                  // Every linked row has a Change button, so its name says which pet it changes.
                  aria-label={`${details.change} ${nameOf(pet.existingPetId, pet.name)}`}
                  onClick={() => {
                    rowToFocus.current = index;
                    onChange(index, { existingPetId: null });
                  }}
                  className={TEXT_BUTTON}
                >
                  {details.change}
                </button>
              </div>
            ) : (
              <>
                {choices.length > 0 && (
                  <PetSourcePicker
                    copy={copy}
                    savedPets={choices}
                    onChange={(existingPetId) => onChange(index, { existingPetId })}
                  />
                )}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <TextField
                    fieldKey={petNameKey(index)}
                    label={details.petName}
                    value={pet.name}
                    maxLength={MAX_LENGTHS.petName}
                    error={visibleError(petNameKey(index))}
                    onBlur={touch(petNameKey(index))}
                    onChange={(value) => onChange(index, { name: value })}
                    autoComplete="off"
                  />
                  <TextField
                    fieldKey={petBreedKey(index)}
                    label={details.breed}
                    value={pet.breed}
                    required={false}
                    maxLength={MAX_LENGTHS.breed}
                    error={visibleError(petBreedKey(index))}
                    onBlur={touch(petBreedKey(index))}
                    onChange={(value) => onChange(index, { breed: value })}
                    autoComplete="off"
                  />
                </div>
              </>
            )}
            {reasons.length > 0 && (
              <p className="m-0 type-meta text-notice-secondary">
                {details.review.notice(
                  reasons.map((reason) => details.review.reasons[reason]).join(copy.listJoiner),
                )}
              </p>
            )}
          </div>
        );
      })}
    </fieldset>
  );
};
