import type { ConciergeDetailsDraft } from '../types';
import type { DetailsDraft } from './validateDetails';

/** Contact fields a description may fill; never the email or password, which the guest types. */
const CONTACT_KEYS = [
  'firstName',
  'lastName',
  'phone',
  'address',
  'emergencyContactNumber',
] as const;

const filled = (current: string | undefined, read: string | null): string =>
  current?.trim() ? current : (read ?? current ?? '');

/**
 * Puts what the description said into the form, only where the form is still empty: nothing the
 * guest typed is replaced. Contact fields only for a guest; pets by the order they were mentioned,
 * and never over a saved pet.
 */
export const applyDetailsDraft = (
  draft: DetailsDraft,
  read: ConciergeDetailsDraft,
  needsContact: boolean,
): DetailsDraft => {
  const contact = { ...draft.contact };
  if (needsContact) {
    for (const key of CONTACT_KEYS) contact[key] = filled(contact[key], read[key]);
  }
  return {
    ...draft,
    contact,
    pets: draft.pets.map((pet, index) => {
      const said = read.pets?.[index];
      if (!said || pet.existingPetId) return pet;
      return { ...pet, name: filled(pet.name, said.name), breed: filled(pet.breed, said.breed) };
    }),
    careNotes: filled(draft.careNotes, read.careNotes),
  };
};

/** The things the description said, in form order, for the guest to check before using them. */
export const saidFields = (read: ConciergeDetailsDraft): Array<[string, string]> => {
  const lines: Array<[string, string]> = [];
  for (const key of CONTACT_KEYS) {
    const value = read[key];
    if (value) lines.push([key, value]);
  }
  read.pets?.forEach((pet, index) => {
    const value = [pet.name, pet.breed].filter(Boolean).join(', ');
    if (value) lines.push([`pet${index}`, value]);
  });
  if (read.careNotes) lines.push(['careNotes', read.careNotes]);
  return lines;
};
