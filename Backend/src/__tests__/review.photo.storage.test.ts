import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  removeReviewPhotos,
  resolveReviewPhotoUrls,
  saveReviewPhotos,
} from '../services/review.photo.storage.js';

const storageEnvironment = {
  AWS_ENDPOINT_URL_S3: 'https://storage.example.test',
  AWS_ACCESS_KEY_ID: 'test-access-key',
  AWS_SECRET_ACCESS_KEY: 'test-secret-key',
  AWS_REGION: 'us-east-2',
  NEON_S3_BUCKET: 'petown',
};

const setStorageEnvironment = (): void => {
  for (const [key, value] of Object.entries(storageEnvironment)) {
    process.env[key] = value;
  }
};

describe('review photo storage', () => {
  let sendMock: ReturnType<typeof vi.spyOn>;

  beforeAll(() => {
    setStorageEnvironment();
  });

  beforeEach(() => {
    sendMock = vi.spyOn(S3Client.prototype, 'send');
    sendMock.mockReset();
    sendMock.mockImplementation(async () => ({}) as never);
  });

  it('stores a JPEG in S3 with the original filename and removes it', async () => {
    const photoKey = (
      await saveReviewPhotos([
        {
          buffer: Buffer.from('jpeg-bytes'),
          mimetype: 'image/jpeg',
          originalname: 'cat photo.jpg',
        } as Express.Multer.File,
      ])
    )[0];

    expect(photoKey).toMatch(/^google-reviews\/[0-9a-f-]+\/cat photo\.jpg$/);
    expect(sendMock).toHaveBeenCalledOnce();
    expect(sendMock.mock.calls[0]?.[0]).toBeInstanceOf(PutObjectCommand);
    expect(sendMock.mock.calls[0]?.[0].input).toMatchObject({
      Bucket: 'petown',
      Key: photoKey,
      Body: Buffer.from('jpeg-bytes'),
      ContentType: 'image/jpeg',
      CacheControl: 'public, max-age=86400, immutable',
    });

    await removeReviewPhotos([photoKey ?? '']);
    expect(sendMock).toHaveBeenCalledTimes(2);
    expect(sendMock.mock.calls[1]?.[0]).toBeInstanceOf(DeleteObjectCommand);
    expect(sendMock.mock.calls[1]?.[0].input).toEqual({
      Bucket: 'petown',
      Key: photoKey,
    });
  });

  it('returns stable public URLs for new keys and legacy local paths', async () => {
    await expect(
      resolveReviewPhotoUrls([
        'google-reviews/upload-1/new-photo.png',
        '/uploads/google-reviews/character-set-01/legacy-photo.png',
      ]),
    ).resolves.toEqual([
      'https://storage.example.test/petown/google-reviews/upload-1/new-photo.png',
      'https://storage.example.test/petown/legacy-photo.png',
    ]);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('cleans up already-uploaded objects when a later upload fails', async () => {
    sendMock
      .mockImplementationOnce(async () => ({}) as never)
      .mockRejectedValueOnce(new Error('second upload failed'))
      .mockImplementationOnce(async () => ({}) as never);

    await expect(
      saveReviewPhotos([
        {
          buffer: Buffer.from('first'),
          mimetype: 'image/png',
          originalname: 'first.png',
        } as Express.Multer.File,
        {
          buffer: Buffer.from('second'),
          mimetype: 'image/png',
          originalname: 'second.png',
        } as Express.Multer.File,
      ]),
    ).rejects.toThrow('second upload failed');

    expect(sendMock).toHaveBeenCalledTimes(4);
    expect(sendMock.mock.calls[2]?.[0]).toBeInstanceOf(DeleteObjectCommand);
    expect(sendMock.mock.calls[2]?.[0].input.Key).toMatch(
      /^google-reviews\/[0-9a-f-]+\/first\.png$/,
    );
    expect(sendMock.mock.calls[3]?.[0]).toBeInstanceOf(DeleteObjectCommand);
    expect(sendMock.mock.calls[3]?.[0].input.Key).toMatch(
      /^google-reviews\/[0-9a-f-]+\/second\.png$/,
    );
  });

  it('rejects unsupported stored references instead of returning a local path', async () => {
    await expect(resolveReviewPhotoUrls(['/tmp/review-photo.png'])).rejects.toThrow(
      'Unsupported review photo reference',
    );
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('rejects an empty upload without calling S3', async () => {
    await expect(
      saveReviewPhotos([
        {
          buffer: Buffer.alloc(0),
          mimetype: 'image/png',
          originalname: 'empty.png',
        } as Express.Multer.File,
      ]),
    ).rejects.toThrow('Uploaded review photo is empty');
    expect(sendMock).not.toHaveBeenCalled();
  });
});
