import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AUDIO_EXTENSION_ALLOWLIST = new Set(['.m4a', '.mp3', '.mp4', '.ogg', '.wav', '.webm']);
const serviceDirectory = path.dirname(fileURLToPath(import.meta.url));

export const FEEDBACK_AUDIO_STORAGE_DIRECTORY = path.resolve(
  serviceDirectory,
  '../../storage/feedback',
);

const getSafeExtension = (originalName: string): string => {
  const extension = path.extname(originalName).toLowerCase();
  return AUDIO_EXTENSION_ALLOWLIST.has(extension) ? extension : '.webm';
};

export const saveFeedbackAudio = async (audioFile: Express.Multer.File): Promise<string> => {
  if (!audioFile.buffer || audioFile.buffer.length === 0) {
    throw new Error('Uploaded audio file is empty');
  }

  await mkdir(FEEDBACK_AUDIO_STORAGE_DIRECTORY, { recursive: true });

  const filename = `${randomUUID()}${getSafeExtension(audioFile.originalname)}`;
  const filePath = path.join(FEEDBACK_AUDIO_STORAGE_DIRECTORY, filename);
  await writeFile(filePath, audioFile.buffer, { flag: 'wx' });

  return `/uploads/feedback/${filename}`;
};

export const removeFeedbackAudio = async (audioUrl: string): Promise<void> => {
  const prefix = '/uploads/feedback/';
  if (!audioUrl.startsWith(prefix)) {
    return;
  }

  await rm(path.join(FEEDBACK_AUDIO_STORAGE_DIRECTORY, path.basename(audioUrl)), {
    force: true,
  });
};
