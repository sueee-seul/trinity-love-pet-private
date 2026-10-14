import { describe, expect, it } from 'vitest';
import {
  TASK_PHOTO_MAX_BYTES,
  TASK_VIDEO_MAX_BYTES,
  checkTaskMediaFile,
  detectTaskVideo,
  type TaskMediaFile,
} from '../services/task.media.file.js';
import { mp4DurationSeconds } from '../services/task.media.mp4.js';
import {
  isTaskVideo,
  isStorableTaskMedia,
  taskMediaKindOf,
  taskMediaRefOf,
  taskVideoContentType,
} from '../services/task.media.js';
import {
  heicBytes,
  jpegBytes,
  movBytes,
  mp4Bytes,
  webmBytes,
} from './fixtures/task.media.fixtures.js';

const file = (originalName: string, mimeType: string, bytes: Buffer): TaskMediaFile => ({
  originalName,
  mimeType,
  bytes,
});

describe('task media kinds', () => {
  it('reads photo or video from the stored name, or from the served path', () => {
    expect(taskMediaKindOf('a.mp4')).toBe('video');
    expect(taskMediaKindOf('/tasks/t1/photos/a.MOV?inline=1')).toBe('video');
    expect(taskMediaKindOf('a.webm')).toBe('video');
    expect(taskMediaKindOf('a.jpg')).toBe('photo');
    expect(isTaskVideo('/tasks/t1/photos/a.jpg?inline=1')).toBe(false);
    expect(taskVideoContentType('a.mov')).toBe('video/quicktime');
    expect(taskVideoContentType('a.png')).toBeNull();
    expect(isStorableTaskMedia('a.mp4')).toBe(true);
    expect(isStorableTaskMedia('a.exe')).toBe(false);
  });

  it('gives an update its media with the kind, or none', () => {
    expect(taskMediaRefOf('/tasks/t1/photos/a.mp4?inline=1')).toEqual({
      kind: 'video',
      url: '/tasks/t1/photos/a.mp4?inline=1',
    });
    expect(taskMediaRefOf('/tasks/t1/photos/a.jpg?inline=1')?.kind).toBe('photo');
    expect(taskMediaRefOf(null)).toBeNull();
  });
});

describe('task media upload check', () => {
  it('accepts an MP4 and a MOV by their own bytes and stores them under the right extension', () => {
    expect(checkTaskMediaFile(file('walk.mp4', 'video/mp4', mp4Bytes()))).toEqual({
      ok: true,
      kind: 'video',
      extension: '.mp4',
    });
    // The browser often sends no type for a phone clip; the bytes still decide.
    expect(checkTaskMediaFile(file('IMG_0001.MOV', '', movBytes()))).toEqual({
      ok: true,
      kind: 'video',
      extension: '.mov',
    });
    expect(checkTaskMediaFile(file('clip.webm', 'video/webm', webmBytes()))).toEqual({
      ok: true,
      kind: 'video',
      extension: '.webm',
    });
  });

  it('rejects an image renamed to look like a video', () => {
    expect(checkTaskMediaFile(file('walk.mp4', 'video/mp4', jpegBytes()))).toEqual({
      ok: false,
      problem: 'not_a_video',
    });
    expect(detectTaskVideo(heicBytes())).toBeNull();
  });

  it('rejects a video over 30 MB, and one longer than a minute when its header says so', () => {
    const large = mp4Bytes(12, TASK_VIDEO_MAX_BYTES);
    expect(checkTaskMediaFile(file('long.mp4', 'video/mp4', large))).toEqual({
      ok: false,
      problem: 'video_too_large',
    });
    expect(checkTaskMediaFile(file('long.mp4', 'video/mp4', mp4Bytes(90)))).toEqual({
      ok: false,
      problem: 'video_too_long',
    });
    expect(mp4DurationSeconds(mp4Bytes(42.5))).toBe(42.5);
    expect(mp4DurationSeconds(jpegBytes())).toBeNull();
  });

  it('keeps the photo rule it had: an image type up to 10 MB', () => {
    expect(checkTaskMediaFile(file('dog.png', 'image/png', jpegBytes()))).toEqual({
      ok: true,
      kind: 'photo',
      extension: '.png',
    });
    expect(checkTaskMediaFile(file('dog', 'image/jpeg', jpegBytes()))).toEqual({
      ok: true,
      kind: 'photo',
      extension: '.jpg',
    });
    expect(
      checkTaskMediaFile(file('dog.jpg', 'image/jpeg', jpegBytes(TASK_PHOTO_MAX_BYTES))),
    ).toEqual({ ok: false, problem: 'photo_too_large' });
    expect(checkTaskMediaFile(file('notes.pdf', 'application/pdf', jpegBytes()))).toEqual({
      ok: false,
      problem: 'unsupported',
    });
    expect(checkTaskMediaFile(file('dog.jpg', 'image/jpeg', Buffer.alloc(0)))).toEqual({
      ok: false,
      problem: 'empty',
    });
  });
});
