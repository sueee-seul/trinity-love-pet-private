import { API_BASE_URL } from '../../../shared/api';
import { persistWithUploadedProfileMedia } from '../../../shared/api/profileMediaApi';
import type { OwnerProfile, OwnerProfileEditInput, Pet, PetFormInput, PetInput } from './types';

const BASE_URL = `${API_BASE_URL}/parent/profile`;

/** What the API returns: the owner and their pets, read from PostgreSQL. */
export interface ParentProfilePayload {
  owner: OwnerProfile;
  pets: Pet[];
}

export class ParentProfileApiError extends Error {
  public readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ParentProfileApiError';
    this.status = status;
  }
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * A rejected write comes back with a sentence explaining the rule that blocked
 * it. Showing that beats "something went wrong", so it is lifted out here.
 * Shared with notificationPreferencesApi.ts, which speaks to the same routes.
 */
export const messageFrom = async (response: Response, fallback: string): Promise<string> => {
  try {
    const payload: unknown = await response.json();
    if (isRecord(payload) && isRecord(payload.error) && typeof payload.error.message === 'string') {
      return payload.error.message;
    }
  } catch {
    // Empty or non-JSON body; the fallback is the best message available.
  }
  return fallback;
};

const parsePayload = async (
  response: Response,
  fallback: string,
): Promise<ParentProfilePayload> => {
  if (!response.ok) {
    throw new ParentProfileApiError(await messageFrom(response, fallback), response.status);
  }

  const payload: unknown = await response.json();
  if (!isRecord(payload) || !isRecord(payload.owner) || !Array.isArray(payload.pets)) {
    throw new ParentProfileApiError('The server sent a profile it could not read', 500);
  }
  return payload as unknown as ParentProfilePayload;
};

export const jsonInit = (method: string, body?: unknown): RequestInit => ({
  method,
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

/**
 * Whose profile this is comes from the session cookie, not from the client.
 * A parent could otherwise read another parent's profile just by passing
 * their email.
 */
export const fetchParentProfile = async (): Promise<ParentProfilePayload> => {
  const response = await fetch(BASE_URL, { credentials: 'include' });
  return parsePayload(response, 'Could not load your profile');
};

export const saveOwner = async (
  ownerId: string,
  changes: OwnerProfileEditInput,
): Promise<ParentProfilePayload> => {
  return persistWithUploadedProfileMedia({
    target: 'avatar',
    file: changes.avatarFile,
    persist: async (uploaded) => {
      const body = {
        ...(changes.fullName !== undefined ? { fullName: changes.fullName } : {}),
        ...(changes.phone !== undefined ? { phone: changes.phone } : {}),
        ...(changes.avatarUrl !== undefined || uploaded
          ? { avatarUrl: uploaded?.assetUrl ?? changes.avatarUrl ?? null }
          : {}),
        ...(changes.address !== undefined ? { address: changes.address } : {}),
        ...(changes.dateOfBirth !== undefined ? { dateOfBirth: changes.dateOfBirth } : {}),
        ...(changes.emergencyContactNumber !== undefined
          ? { emergencyContactNumber: changes.emergencyContactNumber }
          : {}),
      };

      const response = await fetch(
        `${BASE_URL}/${encodeURIComponent(ownerId)}`,
        jsonInit('PATCH', body),
      );
      return parsePayload(response, 'Could not save your profile');
    },
  });
};

const petBodyFrom = (pet: PetFormInput, photoUrl: string | null | undefined): PetInput => ({
  name: pet.name,
  species: pet.species,
  breed: pet.breed,
  photoUrl,
  birthDate: pet.birthDate,
  sex: pet.sex,
  desexed: pet.desexed,
  weightKg: pet.weightKg,
  colour: pet.colour,
  microchip: pet.microchip,
  dietNotes: pet.dietNotes,
  allergies: pet.allergies,
  behaviourNotes: pet.behaviourNotes,
  vetName: pet.vetName,
  vetPhone: pet.vetPhone,
  emergencyContact: pet.emergencyContact,
});

export const createPetOnServer = async (
  ownerId: string,
  pet: PetFormInput,
): Promise<ParentProfilePayload> => {
  return persistWithUploadedProfileMedia({
    target: 'pet-photo',
    file: pet.photoFile,
    persist: async (uploaded) => {
      const response = await fetch(
        `${BASE_URL}/${encodeURIComponent(ownerId)}/pets`,
        jsonInit('POST', petBodyFrom(pet, uploaded?.assetUrl ?? pet.photoUrl)),
      );
      return parsePayload(response, 'Could not add the pet');
    },
  });
};

export const updatePetOnServer = async (
  petId: string,
  pet: PetFormInput,
): Promise<ParentProfilePayload> => {
  return persistWithUploadedProfileMedia({
    target: 'pet-photo',
    file: pet.photoFile,
    petId,
    persist: async (uploaded) => {
      const response = await fetch(
        `${BASE_URL}/pets/${encodeURIComponent(petId)}`,
        jsonInit('PATCH', petBodyFrom(pet, uploaded?.assetUrl ?? pet.photoUrl)),
      );
      return parsePayload(response, 'Could not save the pet');
    },
  });
};

export const deletePetOnServer = async (petId: string): Promise<ParentProfilePayload> => {
  const response = await fetch(`${BASE_URL}/pets/${encodeURIComponent(petId)}`, jsonInit('DELETE'));
  return parsePayload(response, 'Could not delete the pet');
};
