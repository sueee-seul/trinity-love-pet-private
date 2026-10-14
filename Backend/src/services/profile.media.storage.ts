import { randomUUID } from 'node:crypto';
import path from 'node:path';
import {
  OBJECT_STORAGE_CACHE_CONTROL,
  OBJECT_STORAGE_UPLOAD_URL_EXPIRES_SECONDS,
  buildPublicObjectUrl,
  createPresignedPutObjectUrl,
  deleteObject,
  getObjectStorageConfiguration,
  headObject,
} from './object.storage.js';

export const PROFILE_MEDIA_MAX_BYTES = 30 * 1024 * 1024;
export const PROFILE_MEDIA_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
] as const;

export type ProfileMediaTarget = 'avatar' | 'pet-photo';
export type ProfileMediaContentType = (typeof PROFILE_MEDIA_CONTENT_TYPES)[number];

export interface ProfileMediaUploadInput {
  target: ProfileMediaTarget;
  ownerId: string;
  originalName: string;
  contentType: string;
  size: number;
}

export interface ProfileMediaUploadResult {
  uploadUrl: string;
  objectKey: string;
  assetUrl: string;
  expiresIn: number;
  headers: {
    'Content-Type': ProfileMediaContentType;
    'Cache-Control': string;
  };
}

const PROFILE_MEDIA_ROOT = 'profile-media/';
const USER_AVATAR_PREFIX = `${PROFILE_MEDIA_ROOT}users/`;
const PET_PHOTO_PREFIX = `${PROFILE_MEDIA_ROOT}pets/`;

const isProfileMediaContentType = (value: string): value is ProfileMediaContentType =>
  PROFILE_MEDIA_CONTENT_TYPES.some((contentType) => contentType === value);

const getOriginalFilename = (originalName: string): string => {
  const filename = path.posix.basename(originalName.replaceAll('\\', '/'));
  if (!filename || filename === '.' || filename === '..') {
    throw new Error('Profile image filename is required');
  }
  return filename;
};

const getTargetPrefix = (target: ProfileMediaTarget, ownerId: string): string => {
  return target === 'avatar'
    ? `${USER_AVATAR_PREFIX}${ownerId}/`
    : `${PET_PHOTO_PREFIX}${ownerId}/`;
};

const getExpectedPublicBaseUrl = (): URL => {
  const configuration = getObjectStorageConfiguration();
  return new URL(
    `${configuration.bucket}/`,
    configuration.endpoint.endsWith('/') ? configuration.endpoint : `${configuration.endpoint}/`,
  );
};

const getProfileMediaKeyFromUrl = (assetUrl: string): string | null => {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(assetUrl);
  } catch {
    return null;
  }

  let baseUrl: URL;
  try {
    baseUrl = getExpectedPublicBaseUrl();
  } catch {
    return null;
  }
  if (parsedUrl.origin !== baseUrl.origin) {
    return null;
  }
  if (parsedUrl.search || parsedUrl.hash) {
    throw new Error('Profile image reference is not valid for this account');
  }

  const basePath = baseUrl.pathname;
  if (!parsedUrl.pathname.startsWith(basePath)) {
    return null;
  }

  const encodedKey = parsedUrl.pathname.slice(basePath.length);
  try {
    return encodedKey
      .split('/')
      .map((segment) => decodeURIComponent(segment))
      .join('/');
  } catch {
    throw new Error('Profile image reference is not valid for this account');
  }
};

const assertProfileMediaKey = (
  objectKey: string,
  target: ProfileMediaTarget,
  ownerId: string,
): void => {
  const expectedPrefix = getTargetPrefix(target, ownerId);
  const hasTraversalSegment = objectKey
    .split('/')
    .some((segment) => segment === '.' || segment === '..');
  if (!objectKey.startsWith(expectedPrefix) || hasTraversalSegment) {
    throw new Error('Profile image reference is not valid for this account');
  }
};

const assertStoredObject = async (objectKey: string): Promise<void> => {
  let object: Awaited<ReturnType<typeof headObject>>;
  try {
    object = await headObject(objectKey);
  } catch {
    throw new Error('Profile image object is not available');
  }
  if (
    !object.ContentType ||
    !isProfileMediaContentType(object.ContentType) ||
    object.ContentLength === undefined ||
    object.ContentLength <= 0 ||
    object.ContentLength > PROFILE_MEDIA_MAX_BYTES
  ) {
    throw new Error('Profile image object is invalid');
  }
};

export const createProfileMediaUpload = async (
  input: ProfileMediaUploadInput,
): Promise<ProfileMediaUploadResult> => {
  if (!Number.isInteger(input.size) || input.size <= 0 || input.size > PROFILE_MEDIA_MAX_BYTES) {
    throw new Error('Profile image size is invalid');
  }
  if (!isProfileMediaContentType(input.contentType)) {
    throw new Error('Profile image type is not supported');
  }

  const originalFilename = getOriginalFilename(input.originalName);
  const objectKey = `${getTargetPrefix(input.target, input.ownerId)}${randomUUID()}/${originalFilename}`;
  const uploadUrl = await createPresignedPutObjectUrl({
    key: objectKey,
    contentType: input.contentType,
    cacheControl: OBJECT_STORAGE_CACHE_CONTROL,
  });

  return {
    uploadUrl,
    objectKey,
    assetUrl: buildPublicObjectUrl(objectKey),
    expiresIn: OBJECT_STORAGE_UPLOAD_URL_EXPIRES_SECONDS,
    headers: {
      'Content-Type': input.contentType,
      'Cache-Control': OBJECT_STORAGE_CACHE_CONTROL,
    },
  };
};

export const validateProfileMediaUrl = async (
  assetUrl: string | null,
  target: ProfileMediaTarget,
  ownerId: string,
): Promise<string | null> => {
  if (assetUrl === null) {
    return null;
  }
  if (assetUrl.startsWith('data:')) {
    throw new Error('Profile image must be uploaded to object storage');
  }

  const objectKey = getProfileMediaKeyFromUrl(assetUrl);
  if (!objectKey) {
    return assetUrl;
  }

  assertProfileMediaKey(objectKey, target, ownerId);
  await assertStoredObject(objectKey);
  return buildPublicObjectUrl(objectKey);
};

export const removeProfileMediaObject = async (
  objectKey: string,
  target: ProfileMediaTarget,
  ownerId: string,
): Promise<void> => {
  assertProfileMediaKey(objectKey, target, ownerId);
  await deleteObject(objectKey);
};

/**
 * Deletes a deleted pet's photo from object storage when this service stored it for that owner.
 * A photo kept somewhere else (an outside URL) is not ours to delete and is left alone.
 */
export const removePetPhotoAt = async (assetUrl: string | null, ownerId: string): Promise<void> => {
  const objectKey = assetUrl ? getProfileMediaKeyFromUrl(assetUrl) : null;
  if (!objectKey) {
    return;
  }
  await removeProfileMediaObject(objectKey, 'pet-photo', ownerId);
};
