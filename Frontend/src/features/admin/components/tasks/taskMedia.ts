/**
 * A task's media list holds photos and short videos side by side. The stored name's extension says
 * which one an item is, the same rule the backend uses (Backend/src/services/task.media.ts).
 */

export type TaskMediaKind = 'photo' | 'video';

/** What the file picker offers: any photo, or an MP4, MOV or WebM clip. */
export const TASK_MEDIA_ACCEPT = 'image/*,video/mp4,video/quicktime,video/webm';

/** The server refuses a longer upload; checking here saves sending 30 MB to hear it. */
export const TASK_VIDEO_MAX_BYTES = 30 * 1024 * 1024;

export const TASK_VIDEO_TOO_LARGE_MESSAGE =
  'A video can be up to 30 MB. Trim the clip or pick a shorter one.';

const VIDEO_EXTENSION = /\.(mp4|mov|m4v|webm)$/i;

export const taskMediaKindOf = (storedName: string): TaskMediaKind =>
  VIDEO_EXTENSION.test(storedName) ? 'video' : 'photo';

const isVideoFile = (file: File): boolean =>
  file.type.startsWith('video/') || VIDEO_EXTENSION.test(file.name);

/** True when any chosen file is a video over the size the server accepts. */
export const hasOversizedVideo = (files: File[]): boolean =>
  files.some((file) => isVideoFile(file) && file.size > TASK_VIDEO_MAX_BYTES);
