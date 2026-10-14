import { AppError } from '../common/middlewares/error.middleware.js';
import * as repository from '../repositories/parent.profile.repository.js';
import {
  type OwnerEditableFields,
  type ParentPet,
  type ParentProfile,
  type PetWritableFields,
  type Species,
  type Stay,
} from '../contracts/parent-profile.contract.js';
import { PHONE_FORMAT_MESSAGE, isValidPhoneNumber } from '../common/utils/phone.js';
import { removePetPhotoAt, validateProfileMediaUrl } from './profile.media.storage.js';
import { toStayStatus } from './stay-status.js';

const SPECIES: Species[] = ['DOG', 'CAT', 'OTHER'];

const notFound = (what: string): AppError => new AppError(what, 'NOT_FOUND', 404);

const requireText = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AppError(`${field} is required`, 'VALIDATION_ERROR', 400);
  }
  return value.trim();
};

const optionalText = (value: unknown, field: string): string | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value !== 'string') {
    throw new AppError(`${field} must be text`, 'VALIDATION_ERROR', 400);
  }
  return value.trim() || null;
};

const optionalNumber = (value: unknown, field: string): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new AppError(`${field} must be a positive number`, 'VALIDATION_ERROR', 400);
  }
  return parsed;
};

/**
 * A contact number is how the facility reaches a parent, so it is required
 * rather than optional, and it has to be a number that can actually be
 * dialled.
 */
const requirePhoneNumber = (value: unknown, field: string): string => {
  const phone = requireText(value, field);
  if (!isValidPhoneNumber(phone)) {
    throw new AppError(PHONE_FORMAT_MESSAGE, 'VALIDATION_ERROR', 400);
  }
  return phone;
};

/** An optional number may be blank, but a number that is given must be one that can be dialled. */
const optionalPhoneNumber = (value: unknown, field: string): string | null => {
  const phone = optionalText(value, field);
  if (phone !== null && !isValidPhoneNumber(phone)) {
    throw new AppError(PHONE_FORMAT_MESSAGE, 'VALIDATION_ERROR', 400);
  }
  return phone;
};

/**
 * Signup refuses an unparseable or future date of birth; editing the same
 * field afterwards let both through, and an unparseable one only surfaced as
 * a PostgreSQL cast failure - a generic 500 rather than something to act on.
 */
const optionalDateOfBirth = (value: unknown): string | null => {
  const text = optionalText(value, 'Date of birth');
  if (text === null) {
    return null;
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError('Enter a valid date of birth', 'VALIDATION_ERROR', 400);
  }
  if (parsed.getTime() > Date.now()) {
    throw new AppError('Date of birth cannot be in the future', 'VALIDATION_ERROR', 400);
  }
  return text;
};

const asRecord = (input: unknown, what: string): Record<string, unknown> => {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new AppError(`${what} are required`, 'VALIDATION_ERROR', 400);
  }
  return input as Record<string, unknown>;
};

const validatePhotoReference = async (
  value: string | null,
  target: 'avatar' | 'pet-photo',
  ownerId: string,
): Promise<string | null> => {
  try {
    return await validateProfileMediaUrl(value, target, ownerId);
  } catch (error: unknown) {
    throw new AppError(
      error instanceof Error ? error.message : 'Profile image reference is invalid',
      'VALIDATION_ERROR',
      400,
    );
  }
};

/**
 * A pet is validated as a whole rather than field by field: the edit form sends
 * the complete record every time, and accepting a partial one would silently
 * blank whichever fields the caller happened to omit.
 */
const parsePet = (input: unknown): PetWritableFields => {
  const body = asRecord(input, 'Pet details');

  const species = body.species;
  if (!SPECIES.some((candidate) => candidate === species)) {
    throw new AppError('Species must be DOG, CAT or OTHER', 'VALIDATION_ERROR', 400);
  }

  const sex = body.sex;
  if (sex !== undefined && sex !== null && sex !== '' && sex !== 'male' && sex !== 'female') {
    throw new AppError('Sex must be male, female or blank', 'VALIDATION_ERROR', 400);
  }

  const allergies = body.allergies;
  if (allergies !== undefined && !Array.isArray(allergies)) {
    throw new AppError('Allergies must be a list', 'VALIDATION_ERROR', 400);
  }

  return {
    name: requireText(body.name, 'Pet name'),
    species: species as Species,
    breed: optionalText(body.breed, 'Breed'),
    photoUrl: optionalText(body.photoUrl, 'Photo URL'),
    birthDate: optionalText(body.birthDate, 'Birth date'),
    sex: (sex ?? '') as ParentPet['sex'],
    desexed: body.desexed === true,
    weightKg: optionalNumber(body.weightKg, 'Weight'),
    colour: optionalText(body.colour, 'Colour'),
    microchip: optionalText(body.microchip, 'Microchip'),
    dietNotes: optionalText(body.dietNotes, 'Diet notes'),
    allergies: ((allergies as unknown[]) ?? [])
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter((entry) => entry.length > 0),
    behaviourNotes: optionalText(body.behaviourNotes, 'Behaviour notes'),
    vetName: optionalText(body.vetName, 'Vet name'),
    vetPhone: optionalText(body.vetPhone, 'Vet phone'),
    emergencyContact: optionalText(body.emergencyContact, 'Emergency contact'),
  };
};

const parseOwnerEdit = (input: unknown): Partial<OwnerEditableFields> => {
  const body = asRecord(input, 'Profile details');
  const changes: Partial<OwnerEditableFields> = {};

  if (body.fullName !== undefined) {
    changes.fullName = requireText(body.fullName, 'Name');
  }
  if (body.phone !== undefined) {
    changes.phone = requirePhoneNumber(body.phone, 'Phone');
  }
  if (body.avatarUrl !== undefined) {
    changes.avatarUrl = optionalText(body.avatarUrl, 'Avatar URL');
  }
  // Both may be blank: accounts made by the booking form have neither, and
  // no law requires either (20260929_card_guarantee_and_check_in).
  if (body.address !== undefined) {
    changes.address = optionalText(body.address, 'Address');
  }
  if (body.dateOfBirth !== undefined) {
    changes.dateOfBirth = optionalDateOfBirth(body.dateOfBirth);
  }
  if (body.emergencyContactNumber !== undefined) {
    changes.emergencyContactNumber = optionalPhoneNumber(
      body.emergencyContactNumber,
      'Emergency contact number',
    );
  }

  // Email is the account identity. Changing it here would silently detach the
  // profile from the sign-in it is looked up by, so it is refused outright
  // rather than accepted and ignored.
  if (body.email !== undefined && body.email !== null) {
    throw new AppError('Email cannot be changed from the profile screen', 'VALIDATION_ERROR', 400);
  }

  return changes;
};

const toProfileStay = (
  { reviewStatus, checkInOutcome, dropOffTime, pickUpTime, ...stay }: repository.StoredStay,
  now: Date,
): Stay => ({
  ...stay,
  status: toStayStatus({ reviewStatus, checkInOutcome, dropOffTime, pickUpTime }, now),
});

/**
 * Names each stay the way My stays and Home do: the repository returns the manager's decision
 * and the raw times, and the parent stay status rule turns them into one status.
 */
export const withStayStatuses = (
  profile: repository.StoredParentProfile,
  now: Date,
): ParentProfile => ({
  owner: profile.owner,
  pets: profile.pets.map((pet) => ({
    ...pet,
    stays: pet.stays.map((stay) => toProfileStay(stay, now)),
  })),
});

export const getByEmail = async (email: string): Promise<ParentProfile> => {
  const profile = await repository.findProfileByEmail(email);
  if (!profile) {
    throw notFound('No parent account matches that email');
  }
  return withStayStatuses(profile, new Date());
};

export const updateOwner = async (ownerId: string, input: unknown): Promise<ParentProfile> => {
  const changes = parseOwnerEdit(input);
  if (changes.avatarUrl !== undefined) {
    changes.avatarUrl = await validatePhotoReference(changes.avatarUrl, 'avatar', ownerId);
  }

  const profile = await repository.updateOwner(ownerId, changes);
  if (!profile) {
    throw notFound('No parent profile matches that id');
  }
  return withStayStatuses(profile, new Date());
};

export const createPet = async (ownerId: string, input: unknown): Promise<ParentProfile> => {
  const pet = parsePet(input);
  pet.photoUrl = await validatePhotoReference(pet.photoUrl, 'pet-photo', ownerId);

  const profile = await repository.createPet(ownerId, pet);
  if (!profile) {
    throw notFound('No parent profile matches that id');
  }
  return withStayStatuses(profile, new Date());
};

export const updatePet = async (petId: string, input: unknown): Promise<ParentProfile> => {
  const ownerId = await repository.findPetOwnerId(petId);
  if (!ownerId) {
    throw notFound('Pet not found');
  }

  const pet = parsePet(input);
  pet.photoUrl = await validatePhotoReference(pet.photoUrl, 'pet-photo', ownerId);

  const profile = await repository.updatePet(petId, pet);
  if (!profile) {
    throw notFound('Pet not found');
  }
  return withStayStatuses(profile, new Date());
};

const openStayError = (): AppError =>
  new AppError(
    'This pet has a stay that is coming up, under way or not yet paid. Cancel it in My Stays, or contact our team, before deleting this pet.',
    'PET_HAS_OPEN_STAY',
    409,
  );

/**
 * Deletes the pet's profile, medications, care tasks and stored photo. Past stays, payments and
 * feedback stay on record without the profile. The photo goes after the database row: a storage
 * failure is logged for staff to clear up and does not bring the pet back.
 */
export const deletePet = async (petId: string): Promise<ParentProfile> => {
  const result = await repository.deletePet(petId);
  if (result.status === 'not_found') {
    throw notFound('Pet not found');
  }
  if (result.status === 'has_open_stay') {
    throw openStayError();
  }
  await removePetPhotoAt(result.photoUrl, result.profile.owner.id).catch((error: unknown) => {
    console.error('Could not delete the stored photo of a deleted pet', {
      name: error instanceof Error ? error.name : 'unknown',
    });
  });
  return withStayStatuses(result.profile, new Date());
};
