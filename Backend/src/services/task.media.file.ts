import path from 'node:path';
import { TASK_PHOTO_EXTENSIONS, type TaskMediaKind } from './task.media.js';
import { mp4DurationSeconds } from './task.media.mp4.js';

/**
 * What a care task upload may be. Pure, so every rule is unit-tested without a disk or a request.
 * Anyone can set a browser's MIME type, so a video is only a video when its own first bytes say
 * so, and the stored extension comes from those bytes. Photos keep the rule they had before videos
 * came: an image MIME type, up to 10 MB.
 */

export const TASK_PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const TASK_VIDEO_MAX_BYTES = 30 * 1024 * 1024;
/** A daily update carries a short clip, not a film; checked when the file's header says it. */
export const TASK_VIDEO_MAX_SECONDS = 60;

type VideoExtension = '.mp4' | '.mov' | '.webm';

const PHOTO_MIME_EXTENSION: Readonly<Record<string, string>> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/heic': '.heic',
};
const DEFAULT_PHOTO_EXTENSION = '.jpg';

// MP4 and MOV start with a `ftyp` box at byte 4 naming a major brand. QuickTime writes `qt  `; the
// rest are the MP4 family phones and editors write. HEIC and AVIF photos use the same box with
// their own brands, which are not listed, so a photo never passes as a video.
const QUICKTIME_BRAND = 'qt  ';
const MP4_BRANDS: ReadonlySet<string> = new Set([
  'isom',
  'iso2',
  'iso4',
  'iso5',
  'iso6',
  'mp41',
  'mp42',
  'avc1',
  'M4V ',
  'mmp4',
  'dash',
  '3gp4',
  '3gp5',
  '3gp6',
]);
const FTYP_HEADER_BYTES = 12;
// WebM is a Matroska file: an EBML header, whose DocType names `webm` within the first bytes.
const EBML_SIGNATURE = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);
const EBML_DOCTYPE_SCAN_BYTES = 64;

const VIDEO_EXTENSIONS: ReadonlySet<string> = new Set(['.mp4', '.mov', '.m4v', '.webm']);

const brandAt = (bytes: Buffer, offset: number): string =>
  bytes.toString('latin1', offset, offset + 4);

/** The video container the bytes show, as the extension it is stored under, or null. */
export const detectTaskVideo = (bytes: Buffer): VideoExtension | null => {
  if (bytes.length >= FTYP_HEADER_BYTES && brandAt(bytes, 4) === 'ftyp') {
    const majorBrand = brandAt(bytes, 8);
    if (majorBrand === QUICKTIME_BRAND) return '.mov';
    if (MP4_BRANDS.has(majorBrand)) return '.mp4';
    return null;
  }
  const isEbml =
    bytes.length >= EBML_SIGNATURE.length &&
    bytes.subarray(0, EBML_SIGNATURE.length).equals(EBML_SIGNATURE);
  if (isEbml && bytes.subarray(0, EBML_DOCTYPE_SCAN_BYTES).includes('webm', 0, 'latin1')) {
    return '.webm';
  }
  return null;
};

export type TaskMediaProblem =
  | 'empty'
  | 'unsupported'
  | 'not_a_video'
  | 'photo_too_large'
  | 'video_too_large'
  | 'video_too_long';

export type TaskMediaCheck =
  { ok: true; kind: TaskMediaKind; extension: string } | { ok: false; problem: TaskMediaProblem };

export interface TaskMediaFile {
  originalName: string;
  mimeType: string;
  bytes: Buffer;
}

const claimsVideo = (file: TaskMediaFile): boolean =>
  file.mimeType.startsWith('video/') ||
  VIDEO_EXTENSIONS.has(path.extname(file.originalName).toLowerCase());

const photoExtension = (file: TaskMediaFile): string => {
  const fromName = path.extname(file.originalName).toLowerCase();
  if (TASK_PHOTO_EXTENSIONS.has(fromName)) return fromName;
  return PHOTO_MIME_EXTENSION[file.mimeType] ?? DEFAULT_PHOTO_EXTENSION;
};

const checkVideo = (bytes: Buffer, extension: VideoExtension): TaskMediaCheck => {
  if (bytes.length > TASK_VIDEO_MAX_BYTES) return { ok: false, problem: 'video_too_large' };
  // WebM keeps its duration deep in the file and often leaves it out; the size cap covers it.
  const seconds = extension === '.webm' ? null : mp4DurationSeconds(bytes);
  if (seconds !== null && seconds > TASK_VIDEO_MAX_SECONDS) {
    return { ok: false, problem: 'video_too_long' };
  }
  return { ok: true, kind: 'video', extension };
};

/** Whether one uploaded file may join a task's media, and how it is stored. */
export const checkTaskMediaFile = (file: TaskMediaFile): TaskMediaCheck => {
  if (file.bytes.length === 0) return { ok: false, problem: 'empty' };
  const videoExtension = detectTaskVideo(file.bytes);
  if (videoExtension) return checkVideo(file.bytes, videoExtension);
  if (claimsVideo(file)) return { ok: false, problem: 'not_a_video' };
  if (!file.mimeType.startsWith('image/')) return { ok: false, problem: 'unsupported' };
  if (file.bytes.length > TASK_PHOTO_MAX_BYTES) return { ok: false, problem: 'photo_too_large' };
  return { ok: true, kind: 'photo', extension: photoExtension(file) };
};
