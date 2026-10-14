import type { Request, Response } from 'express';
import * as service from '../services/task.service.js';
import type { TaskMediaUpload } from '../services/task.photo.service.js';
import { checkTaskMediaFile, type TaskMediaProblem } from '../services/task.media.file.js';
import { sendTaskMedia } from './task.media.response.js';
import { badRequest, uuidParam, handleError, forbidden } from './task.controller.helpers.js';

const PAYLOAD_TOO_LARGE = 413;

const MEDIA_PROBLEM_MESSAGES: Readonly<Record<TaskMediaProblem, string>> = {
  empty: 'photo file is required',
  unsupported: 'Upload a photo or a short video (MP4, MOV or WebM).',
  not_a_video: 'This file is not an MP4, MOV or WebM video.',
  photo_too_large: 'A photo can be up to 10 MB.',
  video_too_large: 'A video can be up to 30 MB.',
  video_too_long: 'A video can be up to 60 seconds long.',
};

const TOO_LARGE_PROBLEMS: ReadonlySet<TaskMediaProblem> = new Set([
  'photo_too_large',
  'video_too_large',
]);

/** Each file's own bytes decide whether it is a photo or a video, and the stored extension. */
const checkUploads = (
  files: Express.Multer.File[],
): { uploads: TaskMediaUpload[] } | { problem: TaskMediaProblem } => {
  const uploads: TaskMediaUpload[] = [];
  for (const file of files) {
    const check = checkTaskMediaFile({
      originalName: file.originalname ?? '',
      mimeType: file.mimetype ?? '',
      bytes: file.buffer ?? Buffer.alloc(0),
    });
    if (!check.ok) return { problem: check.problem };
    uploads.push({ file, extension: check.extension });
  }
  return { uploads };
};

export async function uploadTaskPhoto(req: Request, res: Response): Promise<void> {
  const id = uuidParam(req.params.taskId);
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (!id) return badRequest(res, 'taskId must be a valid UUID');
  if (files.length === 0) return badRequest(res, 'at least one photo or video file is required');
  const checked = checkUploads(files);
  if ('problem' in checked) {
    const status = TOO_LARGE_PROBLEMS.has(checked.problem) ? PAYLOAD_TOO_LARGE : 400;
    res.status(status).json({ error: MEDIA_PROBLEM_MESSAGES[checked.problem] });
    return;
  }
  try {
    await service.addTaskPhotos(id, checked.uploads);
    res.status(201).json({ ok: true });
  } catch (error) {
    handleError(res, 'Failed to upload task photo', error);
  }
}

export async function deleteTaskPhoto(req: Request, res: Response): Promise<void> {
  const id = uuidParam(req.params.taskId);
  const storedName = typeof req.params.storedName === 'string' ? req.params.storedName : '';
  if (!id) return badRequest(res, 'taskId must be a valid UUID');
  if (!storedName) return badRequest(res, 'photo name is required');
  try {
    await service.deleteTaskPhoto(id, storedName);
    res.status(204).send();
  } catch (error) {
    handleError(res, 'Failed to delete task photo', error);
  }
}

export async function getTaskPhoto(req: Request, res: Response): Promise<void> {
  const id = uuidParam(req.params.taskId);
  const storedName = typeof req.params.storedName === 'string' ? req.params.storedName : '';
  if (!id) return badRequest(res, 'taskId must be a valid UUID');
  if (!req.user?.is_employee) {
    const owns =
      req.user?.is_pet_owner === true && (await service.isTaskOwnedByPetParent(id, req.user.id));
    if (!owns) return forbidden(res);
  }
  if (!storedName) return badRequest(res, 'photo name is required');
  try {
    const photo = await service.getTaskPhoto(id, storedName);
    if (!photo) {
      res.status(404).json({ error: 'No photo for this task' });
      return;
    }
    // Clicking the filename in the UI downloads the file under its original name;
    // `?inline=1` serves it for display instead (e.g. an <img> or <video> in live care).
    const safeName = photo.displayName.replace(/["\r\n]/g, '');
    const disposition =
      req.query.inline === '1' || req.query.inline === 'true' ? 'inline' : 'attachment';
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('Content-Disposition', `${disposition}; filename="${safeName}"`);
    if (!(await sendTaskMedia(req, res, photo.storedName))) {
      res.removeHeader('Content-Disposition');
      res.status(404).json({ error: 'No photo for this task' });
    }
  } catch (error) {
    handleError(res, 'Failed to load task photo', error);
  }
}
