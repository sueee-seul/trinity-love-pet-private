import {
  fillEmptyPetProfile,
  type PetProfileFill,
} from '../../repositories/concierge.pet-profile.repository.js';
import { extractPetDetails, type PetIntakeDraft } from '../pet.intake.service.js';

/**
 * After a booking, each new pet's profile is filled from what the guest told us, so a first-time
 * parent finds a profile card with the details they already gave, not an empty one. It reuses the
 * pet intake reader (pet.intake.service.ts), which keeps only what the words state and never
 * invents a number, a date or a dose.
 *
 * It runs after the booking is saved and answered: a slow or failed read never delays or undoes a
 * booking, and it only fills empty fields, so nothing the parent or staff wrote is replaced.
 */

export interface NewPetForProfile {
  petId: string;
  name: string;
  species: string;
}

/** The reader drops the fields the words did not state, so any field may be missing. */
type ReadDraft = Partial<PetIntakeDraft>;

type ReadPetDetails = (description: string) => Promise<{ draft: ReadDraft }>;

/** The pets table's column sizes; a longer value is dropped rather than cut mid-word. */
const MAX_LENGTH = { breed: 100, colour: 100, vetName: 150, vetPhone: 50 } as const;
const MAX_WEIGHT_KG = 200;

const fitting = (value: string | null | undefined, max: number): string | null => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length <= max ? trimmed : null;
};

const text = (value: string | null | undefined): string | null => value?.trim() || null;

/** A real calendar date that is not in the future, or null. */
const pastDate = (value: string | null | undefined): string | null => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  return date.getTime() <= Date.now() ? value : null;
};

/** One line per medicine, in the words the reader kept, for the health notes staff read. */
const medicationLines = (draft: ReadDraft): string | null => {
  const lines = (draft.medications ?? []).map((medicine) =>
    [
      medicine.name,
      medicine.strength,
      medicine.dose && medicine.unit ? `${medicine.dose} ${medicine.unit}` : null,
      medicine.schedule?.length ? medicine.schedule.join(' and ') : null,
      medicine.instructions,
    ]
      .filter((part): part is string => !!part?.trim())
      .join(', '),
  );
  return lines.length > 0 ? `Medication (from the booking): ${lines.join('; ')}` : null;
};

export const profileFillFrom = (draft: ReadDraft): PetProfileFill => ({
  breed: fitting(draft.breed, MAX_LENGTH.breed),
  weightKg:
    draft.weightKg && draft.weightKg > 0 && draft.weightKg <= MAX_WEIGHT_KG
      ? Math.round(draft.weightKg * 100) / 100
      : null,
  colour: fitting(draft.colour, MAX_LENGTH.colour),
  male: draft.sex ? draft.sex === 'male' : null,
  desexed: draft.desexed === true,
  dietNotes: text(draft.dietNotes),
  allergies: draft.allergies?.length ? draft.allergies.join(', ') : null,
  behaviourNotes: text(draft.behaviourNotes),
  healthNotes: medicationLines(draft),
  vetName: fitting(draft.vetName, MAX_LENGTH.vetName),
  vetPhone: fitting(draft.vetPhone, MAX_LENGTH.vetPhone),
  birthDate: pastDate(draft.birthDate),
});

/** The guest's words, framed so the reader keeps to this one pet when the notes cover several. */
const descriptionFor = (pet: NewPetForProfile, notes: string, petCount: number): string =>
  [
    `Pet name: ${pet.name}. Species: ${pet.species}.`,
    petCount > 1 ? `Only take details that are about ${pet.name}.` : null,
    "What the owner told us when booking (the owner's own words):",
    notes,
  ]
    .filter((line): line is string => line !== null)
    .join('\n');

export const fillPetProfilesFromBooking = async (
  ownerId: string,
  pets: NewPetForProfile[],
  notes: string,
  read: ReadPetDetails = extractPetDetails,
): Promise<void> => {
  const words = notes.trim();
  if (!words || pets.length === 0) return;
  for (const pet of pets) {
    try {
      const { draft } = await read(descriptionFor(pet, words, pets.length));
      await fillEmptyPetProfile(ownerId, pet.petId, profileFillFrom(draft));
    } catch (error: unknown) {
      // The booking stands; the parent can fill the profile in. No notes or names are logged.
      console.error('[concierge] pet profile was not filled from the booking', {
        name: error instanceof Error ? error.name : 'unknown',
      });
    }
  }
};
