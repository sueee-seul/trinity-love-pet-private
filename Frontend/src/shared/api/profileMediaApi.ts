import { API_BASE_URL } from '../api';

const PROFILE_MEDIA_URL = `${API_BASE_URL}/profile-media`;

export type ProfileMediaTarget = 'avatar' | 'pet-photo';

interface ProfileMediaUploadResponse {
  uploadUrl: string;
  objectKey: string;
  assetUrl: string;
  expiresIn: number;
  headers: {
    'Content-Type': string;
    'Cache-Control': string;
  };
}

export interface UploadedProfileMedia {
  objectKey: string;
  assetUrl: string;
}

export interface PersistWithUploadedProfileMediaInput<T> {
  target: ProfileMediaTarget;
  file?: File | null;
  petId?: string;
  persist: (uploaded: UploadedProfileMedia | null) => Promise<T>;
}

export class ProfileMediaApiError extends Error {
  public readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ProfileMediaApiError';
    this.status = status;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const errorMessageFrom = async (response: Response, fallback: string): Promise<string> => {
  try {
    const payload: unknown = await response.json();
    if (isRecord(payload) && isRecord(payload.error) && typeof payload.error.message === 'string') {
      return payload.error.message;
    }
  } catch {
    // The fallback is the best message when the response is not JSON.
  }
  return fallback;
};

const isUploadResponse = (value: unknown): value is ProfileMediaUploadResponse => {
  if (!isRecord(value) || !isRecord(value.headers)) {
    return false;
  }
  return (
    typeof value.uploadUrl === 'string' &&
    typeof value.objectKey === 'string' &&
    typeof value.assetUrl === 'string' &&
    typeof value.expiresIn === 'number' &&
    typeof value.headers['Content-Type'] === 'string' &&
    typeof value.headers['Cache-Control'] === 'string'
  );
};

const requestUploadUrl = async (
  target: ProfileMediaTarget,
  file: File,
  petId?: string,
): Promise<ProfileMediaUploadResponse> => {
  const response = await fetch(`${PROFILE_MEDIA_URL}/upload-url`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      target,
      ...(petId === undefined ? {} : { petId }),
      fileName: file.name,
      contentType: file.type,
      size: file.size,
    }),
  });

  if (!response.ok) {
    throw new ProfileMediaApiError(
      await errorMessageFrom(response, 'Could not prepare the image upload'),
      response.status,
    );
  }

  const payload: unknown = await response.json();
  if (!isUploadResponse(payload)) {
    throw new ProfileMediaApiError('The server sent an invalid image upload response', 500);
  }
  return payload;
};

export const removeProfileMedia = async (
  target: ProfileMediaTarget,
  objectKey: string,
): Promise<void> => {
  const response = await fetch(`${PROFILE_MEDIA_URL}/upload`, {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target, objectKey }),
  });
  if (!response.ok) {
    throw new ProfileMediaApiError(
      await errorMessageFrom(response, 'Could not clean up the uploaded image'),
      response.status,
    );
  }
};

export const uploadProfileMedia = async (
  target: ProfileMediaTarget,
  file: File,
  petId?: string,
): Promise<UploadedProfileMedia> => {
  const upload = await requestUploadUrl(target, file, petId);
  try {
    const response = await fetch(upload.uploadUrl, {
      method: 'PUT',
      headers: upload.headers,
      body: file,
    });
    if (!response.ok) {
      throw new ProfileMediaApiError('Could not upload the image', response.status);
    }
  } catch (error) {
    await removeProfileMedia(target, upload.objectKey).catch(() => undefined);
    throw error;
  }

  return { objectKey: upload.objectKey, assetUrl: upload.assetUrl };
};

export const persistWithUploadedProfileMedia = async <T>(
  input: PersistWithUploadedProfileMediaInput<T>,
): Promise<T> => {
  if (!input.file) {
    return input.persist(null);
  }

  const uploaded = await uploadProfileMedia(input.target, input.file, input.petId);
  try {
    return await input.persist(uploaded);
  } catch (error) {
    await removeProfileMedia(input.target, uploaded.objectKey).catch(() => undefined);
    throw error;
  }
};
