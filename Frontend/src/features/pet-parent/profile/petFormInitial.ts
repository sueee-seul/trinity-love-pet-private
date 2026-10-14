import type { Pet, PetFormInput } from './types';

function blankPet(): PetFormInput {
  return {
    name: '',
    species: 'DOG',
    breed: '',
    photoUrl: null,
    birthDate: '',
    sex: '',
    desexed: false,
    weightKg: null,
    colour: '',
    microchip: '',
    dietNotes: '',
    allergies: [],
    behaviourNotes: '',
    vetName: '',
    vetPhone: '',
    emergencyContact: '',
  };
}

/** What the pet form starts with: the pet being edited, or an empty pet when adding one. */
export function initialPetForm(pet?: Pet): PetFormInput {
  if (!pet) return blankPet();
  return {
    name: pet.name,
    species: pet.species,
    breed: pet.breed ?? '',
    photoUrl: pet.photoUrl ?? null,
    birthDate: pet.birthDate ?? '',
    sex: pet.sex ?? '',
    desexed: pet.desexed,
    weightKg: pet.weightKg ?? null,
    colour: pet.colour ?? '',
    microchip: pet.microchip ?? '',
    dietNotes: pet.dietNotes ?? '',
    allergies: pet.allergies,
    behaviourNotes: pet.behaviourNotes ?? '',
    vetName: pet.vetName ?? '',
    vetPhone: pet.vetPhone ?? '',
    emergencyContact: pet.emergencyContact ?? '',
  };
}
