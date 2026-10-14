import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { TASK_VIDEO_MAX_BYTES } from '../../services/task.media.file.js';
import { MAX_TASK_PHOTOS } from '../../services/task.photo.service.js';

export const TASK_MEDIA_FIELD = 'photos';

// Photos and short videos for one care task, held in memory so the controller can read each file's
// first bytes before anything is written. Multer stops reading at the video cap, so an oversized
// upload never fills the memory; the smaller photo cap is checked per file afterwards. The file
// count matches the per-task cap, so one request holds at most three 30 MB files.
const parseTaskMedia = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: TASK_VIDEO_MAX_BYTES, files: MAX_TASK_PHOTOS },
}).array(TASK_MEDIA_FIELD, MAX_TASK_PHOTOS);

interface LimitAnswer {
  status: number;
  message: string;
}

const TOO_LARGE: LimitAnswer = {
  status: 413,
  message: 'A video can be up to 30 MB and a photo up to 10 MB.',
};
const TOO_MANY: LimitAnswer = {
  status: 400,
  message: `A task can have at most ${MAX_TASK_PHOTOS} photos or videos.`,
};
const WRONG_FIELD: LimitAnswer = {
  status: 400,
  message: 'Send photos or videos in the photos field.',
};

// Multer says "unexpected file" both for a file past the array's count and for a file under
// another field name; the field tells the two apart.
const answerFor = (error: multer.MulterError): LimitAnswer => {
  if (error.code === 'LIMIT_FILE_SIZE') return TOO_LARGE;
  if (error.code === 'LIMIT_FILE_COUNT') return TOO_MANY;
  if (error.code === 'LIMIT_UNEXPECTED_FILE' && error.field === TASK_MEDIA_FIELD) return TOO_MANY;
  return WRONG_FIELD;
};

/** Multer's own errors answer in the `{ error }` shape the task pages already show. */
export const taskMediaUpload = (req: Request, res: Response, next: NextFunction): void => {
  parseTaskMedia(req, res, (error?: unknown) => {
    if (!error) {
      next();
      return;
    }
    if (!(error instanceof multer.MulterError)) {
      next(error);
      return;
    }
    const answer = answerFor(error);
    res.status(answer.status).json({ error: answer.message });
  });
};
