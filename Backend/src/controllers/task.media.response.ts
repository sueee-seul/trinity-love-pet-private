import { pipeline } from 'node:stream/promises';
import type { Request, Response } from 'express';
import { readTaskMedia } from '../services/task.photo.storage.js';

const statusOf = (error: unknown): number | undefined =>
  (error as { $metadata?: { httpStatusCode?: number } } | null)?.$metadata?.httpStatusCode;

/**
 * Sends a stored task photo or video from object storage. A Range request gets 206 and
 * Content-Range, which a <video> needs to seek. Returns false when there is no such file, so the
 * caller answers in its own way. Callers set Cache-Control and Content-Disposition first.
 */
export const sendTaskMedia = async (
  req: Request,
  res: Response,
  storedName: string,
): Promise<boolean> => {
  const range = typeof req.headers.range === 'string' ? req.headers.range : undefined;
  let media;
  try {
    media = await readTaskMedia(storedName, range);
  } catch (error: unknown) {
    if (statusOf(error) !== 416) throw error;
    res.status(416).end();
    return true;
  }
  if (!media) return false;
  res.status(media.contentRange ? 206 : 200);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', media.contentType);
  if (media.contentLength !== null) res.setHeader('Content-Length', String(media.contentLength));
  if (media.contentRange) res.setHeader('Content-Range', media.contentRange);
  try {
    await pipeline(media.body, res);
  } catch {
    // The browser went away mid-file (a skipped video, a closed tab): nothing left to answer.
  }
  return true;
};
