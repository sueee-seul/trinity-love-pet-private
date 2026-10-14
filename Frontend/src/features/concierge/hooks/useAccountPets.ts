import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BOOKING_PET_PARAM } from '../../pet-parent/utils/home';
import { useAccountPetsStore } from '../store/accountPets';
import { useConciergeStore } from '../store/conciergeStore';
import { savedPetChoices } from '../store/savedPetLinks';
import { useSignedInPetOwner } from './useSignedInPetOwner';

/**
 * Adds a pet's "Book a stay" link (?pet=<id>) to the plan. A plan whose request was already sent
 * starts again for it; a plan that is past continuing with a stay is left alone, so nothing agreed is
 * changed behind the parent's back.
 */
const preselectSavedPet = (petId: string): void => {
  const accountPets = useAccountPetsStore.getState().pets;
  if (!accountPets.some((pet) => pet.id === petId)) return;
  if (useConciergeStore.getState().step === 'done') useConciergeStore.getState().startOver();
  const { step, savedPetLinks, applySavedPets } = useConciergeStore.getState();
  if (step !== 'plan' || savedPetLinks.includes(petId)) return;
  const chosen = savedPetLinks.filter((link): link is string => link !== null);
  applySavedPets(savedPetChoices([...chosen, petId], accountPets));
};

/**
 * Loads the signed-in parent's saved pets once for this visit to the booking page (a guest has
 * none), and applies a pet's "Book a stay" link once they have arrived.
 */
export const useAccountPets = (): void => {
  const signedIn = useSignedInPetOwner();
  const load = useAccountPetsStore((state) => state.load);
  const clear = useAccountPetsStore((state) => state.clear);
  const status = useAccountPetsStore((state) => state.status);
  const [searchParams, setSearchParams] = useSearchParams();
  /**
   * The link is read once, when the page opens, and forgotten once applied. It is also taken out
   * of the address: a refresh or the Back button must never apply it again, because on a sent
   * request that would start a new plan and hide the receipt the parent just got.
   */
  const linkedPet = useRef(searchParams.get(BOOKING_PET_PARAM));

  useEffect(() => {
    if (!signedIn) return undefined;
    void load();
    // Leaving the page ends the visit: the next one asks again, so a pet added in between shows.
    return clear;
  }, [signedIn, load, clear]);

  useEffect(() => {
    const petId = linkedPet.current;
    if (!petId || status !== 'ready') return;
    linkedPet.current = null;
    preselectSavedPet(petId);
    if (!searchParams.has(BOOKING_PET_PARAM)) return;
    const next = new URLSearchParams(searchParams);
    next.delete(BOOKING_PET_PARAM);
    setSearchParams(next, { replace: true });
  }, [status, searchParams, setSearchParams]);
};
