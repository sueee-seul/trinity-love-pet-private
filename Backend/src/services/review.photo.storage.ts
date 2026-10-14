import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  OBJECT_STORAGE_CACHE_CONTROL,
  buildPublicObjectUrl,
  deleteObject,
  putObject,
} from './object.storage.js';

const REVIEW_PHOTO_MIME_ALLOWLIST = new Set(['image/jpeg', 'image/png', 'image/gif']);
const REVIEW_PHOTO_S3_KEY_PREFIX = 'google-reviews/';
const LEGACY_REVIEW_PHOTO_URL_PREFIX = '/uploads/google-reviews/';
const serviceDirectory = path.dirname(fileURLToPath(import.meta.url));

/** Kept for the fixture restore maintenance path; runtime uploads no longer use this directory. */
export const GOOGLE_REVIEW_PHOTO_STORAGE_DIRECTORY = path.resolve(
  serviceDirectory,
  '../../storage/google-reviews',
);

const getOriginalFilename = (originalname: string): string => {
  const filename = path.posix.basename(originalname.replaceAll('\\', '/'));
  if (!filename || filename === '.' || filename === '..') {
    throw new Error('Uploaded review photo has no filename');
  }
  return filename;
};

const assertSupportedPhotoType = (mimetype: string): void => {
  if (!REVIEW_PHOTO_MIME_ALLOWLIST.has(mimetype)) {
    throw new Error('Unsupported review photo type');
  }
};

const createReviewPhotoObjectKey = (originalname: string): string =>
  `${REVIEW_PHOTO_S3_KEY_PREFIX}${randomUUID()}/${getOriginalFilename(originalname)}`;

const toStoredObjectKey = (photoReference: string): string | null => {
  if (photoReference.startsWith(REVIEW_PHOTO_S3_KEY_PREFIX)) {
    return photoReference;
  }

  if (!photoReference.startsWith(LEGACY_REVIEW_PHOTO_URL_PREFIX)) {
    return null;
  }

  const legacyFilename = path.posix.basename(
    photoReference.slice(LEGACY_REVIEW_PHOTO_URL_PREFIX.length),
  );
  return legacyFilename && legacyFilename !== '.' && legacyFilename !== '..'
    ? legacyFilename
    : null;
};

export const saveReviewPhotos = async (
  photos: readonly Express.Multer.File[],
): Promise<string[]> => {
  if (photos.some((photo) => !photo.buffer || photo.buffer.length === 0)) {
    throw new Error('Uploaded review photo is empty');
  }

  if (photos.length === 0) {
    return [];
  }

  const savedKeys: string[] = [];

  try {
    for (const photo of photos) {
      assertSupportedPhotoType(photo.mimetype);
      const objectKey = createReviewPhotoObjectKey(photo.originalname);
      savedKeys.push(objectKey);
      await putObject({
        key: objectKey,
        body: photo.buffer,
        contentType: photo.mimetype,
        cacheControl: OBJECT_STORAGE_CACHE_CONTROL,
      });
    }
    return savedKeys;
  } catch (error: unknown) {
    try {
      await removeReviewPhotos(savedKeys);
    } catch (cleanupError: unknown) {
      console.error(
        'Failed to clean up review photo objects after upload failure',
        cleanupError instanceof Error ? cleanupError.message : 'Unknown storage cleanup error',
      );
    }
    throw error;
  }
};

export const removeReviewPhotos = async (photoReferences: readonly string[]): Promise<void> => {
  const objectKeys = [
    ...new Set(
      photoReferences
        .map(toStoredObjectKey)
        .filter((objectKey): objectKey is string => objectKey !== null),
    ),
  ];
  if (objectKeys.length === 0) {
    return;
  }

  await Promise.all(objectKeys.map((objectKey) => deleteObject(objectKey)));
};

export const resolveReviewPhotoUrls = async (
  photoReferences: readonly string[],
): Promise<string[]> => {
  if (photoReferences.length === 0) {
    return [];
  }

  const objectKeys = photoReferences.map((photoReference) => {
    const objectKey = toStoredObjectKey(photoReference);
    if (!objectKey) {
      throw new Error('Unsupported review photo reference');
    }
    return objectKey;
  });
  return objectKeys.map((objectKey) => {
    return buildPublicObjectUrl(objectKey);
  });
};
