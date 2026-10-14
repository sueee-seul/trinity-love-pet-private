import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const media = vi.hoisted(() => ({
  persistWithUploadedProfileMedia: vi.fn(),
}));

vi.mock('../../../shared/api/profileMediaApi', () => media);

import { updateOwnStaffProfile } from './staffApi';
import type { PersistWithUploadedProfileMediaInput } from '../../../shared/api/profileMediaApi';

const staff = {
  id: 'staff-1',
  name: 'Bob Staff',
  username: 'bob.staff',
  email: 'bob@example.test',
  phone: '+64 21 555 0101',
  employee_role: 'staff' as const,
  status: 'active' as const,
  employeeNumber: 'WS-0002',
  joinedDate: '19/05/2024',
  avatarUrl: 'https://old.example.test/avatar.png',
  facilityUuid: 'facility-1',
  facilityName: 'Central',
  employmentType: 'full-time' as const,
  title: null,
  shiftDetails: null,
};

const uploaded = {
  objectKey: 'profile-media/users/staff-1/upload/avatar.png',
  assetUrl: 'https://storage.example.test/petown/profile-media/users/staff-1/upload/avatar.png',
};

const useUploadedMedia = async <T>(input: PersistWithUploadedProfileMediaInput<T>): Promise<T> =>
  input.persist(uploaded);

describe('staff profile image transport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    media.persistWithUploadedProfileMedia.mockImplementation(useUploadedMedia);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uploads a selected avatar before sending the staff JSON update', async () => {
    const file = new File(['avatar'], 'staff avatar.webp', { type: 'image/webp' });
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => staff,
    } as Response);

    await updateOwnStaffProfile('staff-1', { name: 'Bob Staff', avatarFile: file });

    expect(media.persistWithUploadedProfileMedia).toHaveBeenCalledWith(
      expect.objectContaining({ target: 'avatar', file }),
    );
    const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body));
    expect(body).toEqual({ name: 'Bob Staff', avatarUrl: uploaded.assetUrl });
    expect(body).not.toHaveProperty('avatarFile');
  });
});
