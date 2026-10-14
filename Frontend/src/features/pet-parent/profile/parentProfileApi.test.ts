import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const media = vi.hoisted(() => ({
  persistWithUploadedProfileMedia: vi.fn(),
}));

vi.mock('../../../shared/api/profileMediaApi', () => media);

import { createPetOnServer, saveOwner, updatePetOnServer } from './parentProfileApi';
import type { PersistWithUploadedProfileMediaInput } from '../../../shared/api/profileMediaApi';

const profile = {
  owner: {
    id: 'owner-1',
    fullName: 'Ava Mitchell',
    email: 'parent@example.test',
    phone: '021 000 1111',
    avatarUrl: null,
    address: '12 Queen Street',
    dateOfBirth: null,
    emergencyContactNumber: '021 999 0000',
  },
  pets: [],
};

const pet = {
  name: 'Paws',
  species: 'DOG' as const,
  breed: null,
  photoUrl: null,
  birthDate: null,
  sex: '' as const,
  desexed: false,
  weightKg: null,
  colour: null,
  microchip: null,
  dietNotes: null,
  allergies: [],
  behaviourNotes: null,
  vetName: null,
  vetPhone: null,
  emergencyContact: null,
};

const uploaded = {
  objectKey: 'profile-media/users/owner-1/upload/avatar.png',
  assetUrl: 'https://storage.example.test/petown/profile-media/users/owner-1/upload/avatar.png',
};

const useUploadedMedia = async <T>(input: PersistWithUploadedProfileMediaInput<T>): Promise<T> =>
  input.persist(uploaded);

describe('parent profile image transport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    media.persistWithUploadedProfileMedia.mockImplementation(useUploadedMedia);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uploads an owner file first and sends only the stable URL in the profile JSON', async () => {
    const file = new File(['avatar'], 'original avatar.png', { type: 'image/png' });
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => profile,
    } as Response);

    await saveOwner('owner-1', { fullName: 'Ava Mitchell', avatarFile: file });

    expect(media.persistWithUploadedProfileMedia).toHaveBeenCalledWith(
      expect.objectContaining({ target: 'avatar', file }),
    );
    const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject({ fullName: 'Ava Mitchell', avatarUrl: uploaded.assetUrl });
    expect(body).not.toHaveProperty('avatarFile');
  });

  it('uses the pet target for both new-pet and existing-pet photo uploads', async () => {
    const file = new File(['pet'], 'paws.png', { type: 'image/png' });
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, status: 201, json: async () => profile } as Response)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => profile } as Response);

    await createPetOnServer('owner-1', { ...pet, photoFile: file });
    await updatePetOnServer('pet-1', { ...pet, photoFile: file });

    expect(media.persistWithUploadedProfileMedia).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ target: 'pet-photo', file }),
    );
    expect(media.persistWithUploadedProfileMedia).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ target: 'pet-photo', file, petId: 'pet-1' }),
    );
    const createBody = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body));
    const updateBody = JSON.parse(String(vi.mocked(fetch).mock.calls[1]?.[1]?.body));
    expect(createBody.photoUrl).toBe(uploaded.assetUrl);
    expect(updateBody.photoUrl).toBe(uploaded.assetUrl);
    expect(createBody).not.toHaveProperty('photoFile');
    expect(updateBody).not.toHaveProperty('photoFile');
  });
});
