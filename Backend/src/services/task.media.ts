import path from 'node:path';

/**
 * A task's media list (media_logs.photo_url) holds photos and short videos side by side. The stored
 * name's extension says which one a row is, so no extra column is needed; every reader (the file
 * route, live care, the daily update) asks this module instead of checking extensions itself.
 */

export type TaskMediaKind = 'photo' | 'video';

export const TASK_PHOTO_EXTENSIONS: ReadonlySet<string> = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.heic',
]);

const TASK_PHOTO_CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.heic': 'image/heic',
};

const TASK_VIDEO_CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
};

/** The extension of a stored name or of a served path (`/tasks/:id/photos/:name?inline=1`). */
const extensionOf = (nameOrPath: string): string =>
  path.extname(nameOrPath.split('?')[0] ?? '').toLowerCase();

export const isTaskVideo = (nameOrPath: string): boolean =>
  Object.hasOwn(TASK_VIDEO_CONTENT_TYPES, extensionOf(nameOrPath));

export const taskMediaKindOf = (nameOrPath: string): TaskMediaKind =>
  isTaskVideo(nameOrPath) ? 'video' : 'photo';

/** True for a name the task media folder may hold: one of our photo or video extensions. */
export const isStorableTaskMedia = (storedName: string): boolean =>
  TASK_PHOTO_EXTENSIONS.has(extensionOf(storedName)) || isTaskVideo(storedName);

/** The Content-Type a stored video is served with, or null for a photo. */
export const taskVideoContentType = (storedName: string): string | null =>
  TASK_VIDEO_CONTENT_TYPES[extensionOf(storedName)] ?? null;

/** The Content-Type a stored photo or video is kept and served with, from our own lists. */
export const taskMediaContentType = (storedName: string): string =>
  taskVideoContentType(storedName) ??
  TASK_PHOTO_CONTENT_TYPES[extensionOf(storedName)] ??
  'application/octet-stream';

/** The path the browser loads a task's photo or video from, for display rather than download. */
export const taskMediaPath = (taskId: string, storedName: string): string =>
  `/tasks/${taskId}/photos/${encodeURIComponent(storedName)}?inline=1`;

export interface TaskMediaRef {
  kind: TaskMediaKind;
  url: string;
}

/** The media a daily update carries, from the path stored with it. */
export const taskMediaRefOf = (mediaPath: string | null): TaskMediaRef | null =>
  mediaPath === null ? null : { kind: taskMediaKindOf(mediaPath), url: mediaPath };
