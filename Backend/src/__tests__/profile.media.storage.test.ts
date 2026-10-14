import { beforeEach, describe, expect, it, vi } from 'vitest';

const objectStorage = vi.hoisted(() => ({
  OBJECT_STORAGE_CACHE_CONTROL: 'public, max-age=86400, immutable',
  OBJECT_STORAGE_UPLOAD_URL_EXPIRES_SECONDS: 300,
  buildPublicObjectUrl: vi.fn((key: string) => `https://storage.example.test/petown/${key}`),
  createPresignedPutObjectUrl: vi.fn(),
  deleteObject: vi.fn(),
  getObjectStorageConfiguration: vi.fn(() => ({
    endpoint: 'https://storage.example.test',
    region: 'us-east-2',
    accessKeyId: 'access-key',
    secretAccessKey: 'secret-key',
    bucket: 'petown',
  })),
  headObject: vi.fn(),
}));

vi.mock('../services/object.storage.js', () => objectStorage);

import {
  createProfileMediaUpload,
  removePetPhotoAt,
  removeProfileMediaObject,
  validateProfileMediaUrl,
} from '../services/profile.media.storage.js';

describe('profile media storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    objectStorage.createPresignedPutObjectUrl.mockResolvedValue('https://upload.example.test');
    objectStorage.headObject.mockResolvedValue({
      ContentType: 'image/png',
      ContentLength: 12,
    });
  });

  it('preserves the original filename in an owner-scoped upload key', async () => {
    const result = await createProfileMediaUpload({
      target: 'avatar',
      ownerId: 'owner-1',
      originalName: 'C:\\fake\\profile photo.png',
      contentType: 'image/png',
      size: 12,
    });

    expect(result).toMatchObject({
      uploadUrl: 'https://upload.example.test',
      assetUrl: expect.stringContaining('/profile-media/users/owner-1/'),
      expiresIn: 300,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400, immutable',
      },
    });
    expect(result.objectKey).toMatch(
      /^profile-media\/users\/owner-1\/[0-9a-f-]+\/profile photo\.png$/,
    );
    expect(objectStorage.createPresignedPutObjectUrl).toHaveBeenCalledWith({
      key: result.objectKey,
      contentType: 'image/png',
      cacheControl: 'public, max-age=86400, immutable',
    });
  });

  it('uses the pet owner scope for pet photos and rejects invalid metadata', async () => {
    const result = await createProfileMediaUpload({
      target: 'pet-photo',
      ownerId: 'owner-1',
      originalName: 'paws.webp',
      contentType: 'image/webp',
      size: 10,
    });

    expect(result.objectKey).toMatch(/^profile-media\/pets\/owner-1\/[0-9a-f-]+\/paws\.webp$/);
    await expect(
      createProfileMediaUpload({
        target: 'avatar',
        ownerId: 'owner-1',
        originalName: 'too-large.png',
        contentType: 'image/png',
        size: 30 * 1024 * 1024 + 1,
      }),
    ).rejects.toThrow('size is invalid');
    await expect(
      createProfileMediaUpload({
        target: 'avatar',
        ownerId: 'owner-1',
        originalName: 'document.pdf',
        contentType: 'application/pdf',
        size: 10,
      }),
    ).rejects.toThrow('type is not supported');
  });

  it('rejects data URLs and validates stored object ownership before persistence', async () => {
    await expect(
      validateProfileMediaUrl('data:image/png;base64,ZmFrZQ==', 'avatar', 'owner-1'),
    ).rejects.toThrow('must be uploaded to object storage');

    await expect(
      validateProfileMediaUrl(
        'https://storage.example.test/petown/profile-media/users/other-owner/id/photo.png',
        'avatar',
        'owner-1',
      ),
    ).rejects.toThrow('not valid for this account');
    expect(objectStorage.headObject).not.toHaveBeenCalled();

    await expect(
      validateProfileMediaUrl(
        'https://storage.example.test/petown/profile-media/users/owner-1/id/photo.png?version=1',
        'avatar',
        'owner-1',
      ),
    ).rejects.toThrow('not valid for this account');

    await expect(
      validateProfileMediaUrl(
        'https://storage.example.test/petown/profile-media/users/owner-1/id/photo.png',
        'avatar',
        'owner-1',
      ),
    ).resolves.toBe('https://storage.example.test/petown/profile-media/users/owner-1/id/photo.png');
    expect(objectStorage.headObject).toHaveBeenCalledWith(
      'profile-media/users/owner-1/id/photo.png',
    );
  });

  it('keeps an existing external URL and deletes only an owner-scoped object', async () => {
    await expect(
      validateProfileMediaUrl('https://images.example.test/avatar.png', 'avatar', 'owner-1'),
    ).resolves.toBe('https://images.example.test/avatar.png');

    await removeProfileMediaObject(
      'profile-media/pets/owner-1/upload-1/paws.png',
      'pet-photo',
      'owner-1',
    );
    expect(objectStorage.deleteObject).toHaveBeenCalledWith(
      'profile-media/pets/owner-1/upload-1/paws.png',
    );
  });

  it("removes a deleted pet's stored photo, and leaves outside or missing photos alone", async () => {
    await removePetPhotoAt(
      'https://storage.example.test/petown/profile-media/pets/owner-1/upload-1/paws.png',
      'owner-1',
    );
    expect(objectStorage.deleteObject).toHaveBeenCalledWith(
      'profile-media/pets/owner-1/upload-1/paws.png',
    );

    objectStorage.deleteObject.mockClear();
    await removePetPhotoAt('https://images.example.test/paws.png', 'owner-1');
    await removePetPhotoAt(null, 'owner-1');
    expect(objectStorage.deleteObject).not.toHaveBeenCalled();

    // Another owner's photo is never deleted on this owner's behalf.
    await expect(
      removePetPhotoAt(
        'https://storage.example.test/petown/profile-media/pets/owner-2/upload-1/paws.png',
        'owner-1',
      ),
    ).rejects.toThrow('not valid for this account');
  });
});
