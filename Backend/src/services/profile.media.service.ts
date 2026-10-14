import { AppError } from '../common/middlewares/error.middleware.js';
import type { AuthenticatedUser } from './auth.service.js';
import { findPetOwnerId } from '../repositories/parent.profile.repository.js';
import {
  createProfileMediaUpload,
  removeProfileMediaObject,
  type ProfileMediaTarget,
  type ProfileMediaUploadInput,
  type ProfileMediaUploadResult,
} from './profile.media.storage.js';

const forbidden = (): AppError =>
  new AppError('You do not have permission to use this profile image', 'FORBIDDEN', 403);

const requirePetParent = (actor: AuthenticatedUser): void => {
  if (actor.is_pet_owner !== true || actor.is_employee === true) {
    throw forbidden();
  }
};

export interface CreateProfileMediaUploadInput extends Omit<ProfileMediaUploadInput, 'ownerId'> {
  petId?: string;
}

export const createUploadUrl = async (
  actor: AuthenticatedUser,
  input: CreateProfileMediaUploadInput,
): Promise<ProfileMediaUploadResult> => {
  if (input.target === 'pet-photo') {
    requirePetParent(actor);
    if (input.petId) {
      const ownerId = await findPetOwnerId(input.petId);
      if (ownerId !== actor.id) {
        throw forbidden();
      }
    }
  } else if (input.petId !== undefined) {
    throw new AppError('Pet ID is not valid for an avatar upload', 'VALIDATION_ERROR', 400);
  }

  return createProfileMediaUpload({ ...input, ownerId: actor.id });
};

export const removeUpload = async (
  actor: AuthenticatedUser,
  target: ProfileMediaTarget,
  objectKey: string,
): Promise<void> => {
  if (target === 'pet-photo') {
    requirePetParent(actor);
  }
  await removeProfileMediaObject(objectKey, target, actor.id);
};
