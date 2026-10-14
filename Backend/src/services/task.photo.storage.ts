import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { deleteObject, getObject, putObject } from './object.storage.js';
import { isStorableTaskMedia, taskMediaContentType } from './task.media.js';

// Task completion photos and short videos live in the Neon project's object storage, under
// `tasks/`, so every server and every checkout sees the same files. The media_logs rows only carry
// the short stored name, whose extension says photo or video (task.media.ts). The browser never
// gets the storage address: the API checks who is asking and passes the bytes on.

const TASK_MEDIA_PREFIX = 'tasks/';

// Read through the API, which checks the reader first, so nothing on the way may keep a copy.
const TASK_MEDIA_CACHE_CONTROL = 'private, max-age=300';

/** The object key for a stored name, or null for a name that is not one of ours. */
export const taskMediaKey = (storedName: string): string | null => {
  const safe = path.basename(storedName);
  if (!safe || safe !== storedName) return null;
  if (!isStorableTaskMedia(safe)) return null;
  return `${TASK_MEDIA_PREFIX}${safe}`;
};

/**
 * Stores an uploaded photo or video under the extension the upload check chose
 * (task.media.file.ts). Returns the random stored name (kept in media_logs.photo_url) and a
 * cleaned original name (kept in media_logs.caption so the UI can show a filename and the
 * download can be named).
 */
export const saveTaskPhoto = async (
  mediaFile: Express.Multer.File,
  extension: string,
): Promise<{ storedName: string; displayName: string }> => {
  if (!mediaFile.buffer || mediaFile.buffer.length === 0) {
    throw new Error('Uploaded media file is empty');
  }
  const storedName = `${randomUUID()}${extension}`;
  const key = taskMediaKey(storedName);
  if (!key) throw new Error('Unsupported task media extension');
  await putObject({
    key,
    body: mediaFile.buffer,
    contentType: taskMediaContentType(storedName),
    cacheControl: TASK_MEDIA_CACHE_CONTROL,
  });
  const displayName =
    path.basename(mediaFile.originalname || storedName).slice(0, 200) || storedName;
  return { storedName, displayName };
};

/** One stored photo or video, whole or the byte range the browser asked for. */
export interface TaskMediaRead {
  body: Readable;
  contentType: string;
  contentLength: number | null;
  /** Set when only part was sent: `bytes 0-99/1000`, answered with 206. */
  contentRange: string | null;
}

const isMissing = (error: unknown): boolean =>
  error instanceof Error &&
  (error.name === 'NoSuchKey' ||
    error.name === 'NotFound' ||
    (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404);

/**
 * Reads a stored photo or video. Null for a name that is not ours or a file that is not there; a
 * storage outage is an error, never a missing photo.
 */
export const readTaskMedia = async (
  storedName: string,
  range?: string,
): Promise<TaskMediaRead | null> => {
  const key = taskMediaKey(storedName);
  if (!key) return null;
  try {
    const object = await getObject(key, range);
    if (!object.Body) return null;
    return {
      body: object.Body as Readable,
      // Our own type for the name, so a clip always plays inline whatever the store recorded.
      contentType: taskMediaContentType(storedName),
      contentLength: object.ContentLength ?? null,
      contentRange: object.ContentRange ?? null,
    };
  } catch (error: unknown) {
    if (isMissing(error)) return null;
    throw error;
  }
};

/** Deletes a stored photo or video; a missing file is not an error. */
export const removeTaskPhoto = async (storedName: string): Promise<void> => {
  const key = taskMediaKey(storedName);
  if (key) await deleteObject(key);
};
