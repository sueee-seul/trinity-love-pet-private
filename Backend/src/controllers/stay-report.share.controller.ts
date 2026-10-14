import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../common/middlewares/error.middleware.js';
import {
  renderSharedStayReport,
  shareLinkForOwner,
  sharedStayPhotoName,
  sharedStayReport,
} from '../services/stay-report.share.service.js';
import { sendTaskMedia } from './task.media.response.js';

/** GET /api/petparent/stays/:bookingPetId/report/share-link: a 30-day link for the parent's vet. */
export const getStayReportShareLink = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user) throw new AppError('Authentication required', 'UNAUTHENTICATED', 401);
    const bookingPetId = z.string().uuid().parse(req.params.bookingPetId);
    res.status(200).json(await shareLinkForOwner(req.user.id, bookingPetId));
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/share/stay-report/:token: the printable page, no sign-in. An expired or forged link gets
 * a short page, not a JSON error, because a vet opens this in a browser.
 */
/** GET /api/share/stay-report/:token/photos/:taskId/:storedName: one of the page's photos. */
export const getSharedStayPhoto = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const token = z.string().min(20).max(4096).parse(req.params.token);
    const taskId = z.string().uuid().parse(req.params.taskId);
    const storedName = z.string().min(1).max(255).parse(req.params.storedName);
    const ownName = await sharedStayPhotoName(token, taskId, storedName);
    res.set('Cache-Control', 'private, max-age=300');
    if (!(await sendTaskMedia(req, res, ownName))) res.status(404).end();
  } catch (error) {
    if (error instanceof AppError && (error.statusCode === 410 || error.statusCode === 404)) {
      res.status(error.statusCode).end();
      return;
    }
    next(error);
  }
};

export const getSharedStayReport = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const token = z.string().min(20).max(4096).parse(req.params.token);
    const report = await sharedStayReport(token);
    res.set('Cache-Control', 'private, no-store');
    res.status(200).type('html').send(renderSharedStayReport(report));
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 410) {
      res
        .status(410)
        .type('html')
        .send(
          '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Link expired</title></head><body><p>This report link has expired or is not valid. Please ask the pet parent for a new one.</p></body></html>',
        );
      return;
    }
    next(error);
  }
};
