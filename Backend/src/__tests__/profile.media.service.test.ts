import { beforeEach, describe, expect, it, vi } from 'vitest';

const repository = vi.hoisted(() => ({ findPetOwnerId: vi.fn() }));
const storage = vi.hoisted(() => ({
  createProfileMediaUpload: vi.fn(),
  removeProfileMediaObject: vi.fn(),
}));

vi.mock('../repositories/parent.profile.repository.js', () => repository);
vi.mock('../services/profile.media.storage.js', () => storage);

import type { AuthenticatedUser } from '../services/auth.service.js';
import { createUploadUrl, removeUpload } from '../services/profile.media.service.js';

const parent: AuthenticatedUser = {
  id: 'owner-1',
  email: 'parent@example.test',
  name: 'Parent',
  is_employee: false,
  is_pet_owner: true,
  employee_role: null,
  isUsingTemporaryPassword: false,
};

const employee: AuthenticatedUser = {
  ...parent,
  id: 'staff-1',
  is_employee: true,
  is_pet_owner: false,
  employee_role: 'staff',
};

describe('profile media service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repository.findPetOwnerId.mockResolvedValue('owner-1');
    storage.createProfileMediaUpload.mockResolvedValue({
      uploadUrl: 'https://upload.example.test',
      objectKey: 'profile-media/pets/owner-1/upload/paws.png',
      assetUrl: 'https://storage.example.test/petown/profile-media/pets/owner-1/upload/paws.png',
      expiresIn: 300,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400, immutable',
      },
    });
  });

  it('uses the authenticated owner id for an avatar upload', async () => {
    await createUploadUrl(parent, {
      target: 'avatar',
      originalName: 'avatar.png',
      contentType: 'image/png',
      size: 12,
    });

    expect(storage.createProfileMediaUpload).toHaveBeenCalledWith({
      target: 'avatar',
      ownerId: 'owner-1',
      originalName: 'avatar.png',
      contentType: 'image/png',
      size: 12,
    });
  });

  it('requires a pet-parent session and verifies an existing pet owner', async () => {
    await expect(
      createUploadUrl(employee, {
        target: 'pet-photo',
        petId: 'pet-1',
        originalName: 'paws.png',
        contentType: 'image/png',
        size: 12,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });

    repository.findPetOwnerId.mockResolvedValueOnce('other-owner');
    await expect(
      createUploadUrl(parent, {
        target: 'pet-photo',
        petId: 'pet-1',
        originalName: 'paws.png',
        contentType: 'image/png',
        size: 12,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(storage.createProfileMediaUpload).not.toHaveBeenCalled();
  });

  it('allows a new pet photo before the pet id exists and scopes cleanup to the actor', async () => {
    await createUploadUrl(parent, {
      target: 'pet-photo',
      originalName: 'paws.png',
      contentType: 'image/png',
      size: 12,
    });
    expect(repository.findPetOwnerId).not.toHaveBeenCalled();

    await removeUpload(parent, 'pet-photo', 'profile-media/pets/owner-1/upload/paws.png');
    expect(storage.removeProfileMediaObject).toHaveBeenCalledWith(
      'profile-media/pets/owner-1/upload/paws.png',
      'pet-photo',
      'owner-1',
    );
  });
});
