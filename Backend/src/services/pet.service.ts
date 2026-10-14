import * as petRepository from '../repositories/pet.repository.js';
import type { Pet, PetGender, PetType } from '../contracts/pet.contract.js';
import { AppError } from '../common/middlewares/error.middleware.js';
import { toStayStatus } from './stay-status.js';

/**
 * Names a pet by its current or next stay with the rule the owner's pages use, so the staff pet
 * list and My stays never call the same stay two things.
 */
const withStayStatus = (
  { stay, ...record }: petRepository.PetRecord,
  now: Date,
): Pet & petRepository.PetDetailFields => ({
  ...record,
  status: stay ? toStayStatus(stay, now) : 'no_stay',
});

export const getList = async (): Promise<(Pet & petRepository.PetDetailFields)[]> => {
  const records = await petRepository.listPetRecords();
  const now = new Date();
  return records.map((record) => withStayStatus(record, now));
};

export type PetDetail = Pet &
  petRepository.PetDetailFields & { medications: petRepository.PetMedication[] };

export const getDetail = async (id: string): Promise<PetDetail> => {
  const record = await petRepository.getPetRecordById(id);
  if (!record) {
    throw new AppError('Pet not found', 'NOT_FOUND', 404);
  }
  const medications = await petRepository.listPetMedications(id);
  return { ...withStayStatus(record, new Date()), medications };
};

export const updateHealthNotes = async (
  id: string,
  healthNotes: string | null,
): Promise<PetDetail> => {
  const updated = await petRepository.updatePetHealthNotes(id, healthNotes);
  if (!updated) {
    throw new AppError('Pet not found', 'NOT_FOUND', 404);
  }
  return getDetail(id);
};

export const updateBehaviourNotes = async (
  id: string,
  behaviourNotes: string | null,
): Promise<PetDetail> => {
  const updated = await petRepository.updatePetBehaviourNotes(id, behaviourNotes);
  if (!updated) {
    throw new AppError('Pet not found', 'NOT_FOUND', 404);
  }
  return getDetail(id);
};

export type MedicationInput = petRepository.PetMedicationInput;

export const addMedication = async (id: string, input: MedicationInput): Promise<PetDetail> => {
  const pet = await petRepository.getPetRecordById(id);
  if (!pet) {
    throw new AppError('Pet not found', 'NOT_FOUND', 404);
  }
  await petRepository.createPetMedication(id, input);
  return getDetail(id);
};

export const editMedication = async (
  id: string,
  medicationId: string,
  input: petRepository.PartialPetMedicationInput,
): Promise<PetDetail> => {
  const updated = await petRepository.updatePetMedication(id, medicationId, input);
  if (!updated) {
    throw new AppError('Medication not found', 'NOT_FOUND', 404);
  }
  return getDetail(id);
};

export const removeMedication = async (id: string, medicationId: string): Promise<PetDetail> => {
  const deleted = await petRepository.deletePetMedication(id, medicationId);
  if (!deleted) {
    throw new AppError('Medication not found', 'NOT_FOUND', 404);
  }
  return getDetail(id);
};

export interface UpdatePetProfileInput {
  type: PetType;
  gender: PetGender;
  age: number;
  ownerName: string;
  breed: string | null;
  weight: number | null;
  microchipNumber: string | null;
}

export const updateProfile = async (
  id: string,
  input: UpdatePetProfileInput,
): Promise<PetDetail> => {
  const updated = await petRepository.updatePetRecord(id, {
    type: input.type,
    gender: input.gender,
    age: input.age,
    ownerName: input.ownerName,
    breed: input.breed,
    weight: input.weight,
    microchipNumber: input.microchipNumber,
  });
  if (!updated) {
    throw new AppError('Pet not found', 'NOT_FOUND', 404);
  }
  return getDetail(id);
};
