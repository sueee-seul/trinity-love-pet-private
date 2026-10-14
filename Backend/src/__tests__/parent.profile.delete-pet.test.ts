import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as repository from '../repositories/parent.profile.repository.js';
import type { StoredParentProfile } from '../repositories/parent.profile.repository.js';
import { removePetPhotoAt } from '../services/profile.media.storage.js';
import { deletePet } from '../services/parent.profile.service.js';

vi.mock('../repositories/parent.profile.repository.js', () => ({ deletePet: vi.fn() }));
vi.mock('../services/profile.media.storage.js', () => ({
  validateProfileMediaUrl: vi.fn(),
  removePetPhotoAt: vi.fn(async () => undefined),
}));

const PET_ID = '00000000-0000-4000-8000-0000000000a1';
const OWNER_ID = '00000000-0000-4000-8000-0000000000b1';
const PHOTO = 'https://storage.example/bucket/pet-photos/owner/photo.jpg';
const profile = { owner: { id: OWNER_ID }, pets: [] } as unknown as StoredParentProfile;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('deleting a pet', () => {
  it('refuses while a stay is coming up, under way or unpaid, and touches no photo', async () => {
    vi.mocked(repository.deletePet).mockResolvedValue({ status: 'has_open_stay' });

    await expect(deletePet(PET_ID)).rejects.toMatchObject({
      statusCode: 409,
      code: 'PET_HAS_OPEN_STAY',
    });
    expect(removePetPhotoAt).not.toHaveBeenCalled();
  });

  it('answers 404 for a pet that does not exist', async () => {
    vi.mocked(repository.deletePet).mockResolvedValue({ status: 'not_found' });

    await expect(deletePet(PET_ID)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('removes the stored photo after the profile is deleted', async () => {
    vi.mocked(repository.deletePet).mockResolvedValue({
      status: 'deleted',
      profile,
      photoUrl: PHOTO,
    });

    await expect(deletePet(PET_ID)).resolves.toMatchObject({ owner: { id: OWNER_ID } });
    expect(removePetPhotoAt).toHaveBeenCalledWith(PHOTO, OWNER_ID);
  });

  it('keeps the deletion when the photo cannot be removed from storage', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(repository.deletePet).mockResolvedValue({
      status: 'deleted',
      profile,
      photoUrl: PHOTO,
    });
    vi.mocked(removePetPhotoAt).mockRejectedValueOnce(new Error('storage offline'));

    await expect(deletePet(PET_ID)).resolves.toMatchObject({ owner: { id: OWNER_ID } });
    // The log names the failure, never the photo address.
    expect(JSON.stringify(logged.mock.calls)).not.toContain(PHOTO);
  });
});
