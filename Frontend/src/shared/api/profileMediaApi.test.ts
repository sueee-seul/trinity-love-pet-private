import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  persistWithUploadedProfileMedia,
  removeProfileMedia,
  uploadProfileMedia,
} from './profileMediaApi';

const upload = {
  uploadUrl: 'https://storage.example.test/petown/upload-url',
  objectKey: 'profile-media/users/owner-1/upload/avatar.png',
  assetUrl: 'https://storage.example.test/petown/profile-media/users/owner-1/upload/avatar.png',
  expiresIn: 300,
  headers: {
    'Content-Type': 'image/png',
    'Cache-Control': 'public, max-age=86400, immutable',
  },
};

describe('profileMediaApi', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('requests a signed URL, then sends the raw file to object storage', async () => {
    const file = new File(['fake-png'], 'my avatar.png', { type: 'image/png' });
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => upload } as Response)
      .mockResolvedValueOnce({ ok: true, status: 200 } as Response);

    await expect(uploadProfileMedia('avatar', file)).resolves.toEqual({
      objectKey: upload.objectKey,
      assetUrl: upload.assetUrl,
    });

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'http://localhost:3000/api/profile-media/upload-url',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          target: 'avatar',
          fileName: 'my avatar.png',
          contentType: 'image/png',
          size: file.size,
        }),
      }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      upload.uploadUrl,
      expect.objectContaining({
        method: 'PUT',
        headers: upload.headers,
        body: file,
      }),
    );
  });

  it('cleans up the reserved object when the direct PUT fails', async () => {
    const file = new File(['fake-png'], 'my avatar.png', { type: 'image/png' });
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => upload } as Response)
      .mockResolvedValueOnce({ ok: false, status: 503 } as Response)
      .mockResolvedValueOnce({ ok: true, status: 204 } as Response);

    await expect(uploadProfileMedia('avatar', file)).rejects.toThrow('Could not upload the image');
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      'http://localhost:3000/api/profile-media/upload',
      expect.objectContaining({
        method: 'DELETE',
        body: JSON.stringify({ target: 'avatar', objectKey: upload.objectKey }),
      }),
    );
  });

  it('cleans up the uploaded object when the persistence callback fails', async () => {
    const file = new File(['fake-png'], 'my avatar.png', { type: 'image/png' });
    const persistenceError = new Error('Profile write failed');
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => upload } as Response)
      .mockResolvedValueOnce({ ok: true, status: 200 } as Response)
      .mockResolvedValueOnce({ ok: true, status: 204 } as Response);

    await expect(
      persistWithUploadedProfileMedia({
        target: 'avatar',
        file,
        persist: async () => {
          throw persistenceError;
        },
      }),
    ).rejects.toBe(persistenceError);
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      'http://localhost:3000/api/profile-media/upload',
      expect.objectContaining({
        method: 'DELETE',
        body: JSON.stringify({ target: 'avatar', objectKey: upload.objectKey }),
      }),
    );
  });

  it('does not upload when the caller has no new file', async () => {
    const persist = vi.fn().mockResolvedValue('saved');

    await expect(
      persistWithUploadedProfileMedia({ target: 'avatar', file: null, persist }),
    ).resolves.toBe('saved');
    expect(persist).toHaveBeenCalledWith(null);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('forwards an existing pet id to the signed-upload request', async () => {
    const file = new File(['fake-png'], 'paws.png', { type: 'image/png' });
    const persist = vi.fn().mockResolvedValue('saved');
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => upload } as Response)
      .mockResolvedValueOnce({ ok: true, status: 200 } as Response);

    await expect(
      persistWithUploadedProfileMedia({
        target: 'pet-photo',
        file,
        petId: 'pet-1',
        persist,
      }),
    ).resolves.toBe('saved');
    const requestBody = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body));
    expect(requestBody).toMatchObject({ target: 'pet-photo', petId: 'pet-1' });
  });

  it('deletes an uploaded object through the authenticated API', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, status: 204 } as Response);

    await expect(
      removeProfileMedia('pet-photo', 'profile-media/pets/owner-1/upload/paws.png'),
    ).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/profile-media/upload',
      expect.objectContaining({
        method: 'DELETE',
        credentials: 'include',
        body: JSON.stringify({
          target: 'pet-photo',
          objectKey: 'profile-media/pets/owner-1/upload/paws.png',
        }),
      }),
    );
  });
});
