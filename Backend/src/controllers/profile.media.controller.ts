import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import {
  PROFILE_MEDIA_CONTENT_TYPES,
  PROFILE_MEDIA_MAX_BYTES,
} from '../services/profile.media.storage.js';
import * as profileMediaService from '../services/profile.media.service.js';

const profileMediaTargetSchema = z.enum(['avatar', 'pet-photo']);
const contentTypeSchema = z.enum(PROFILE_MEDIA_CONTENT_TYPES);

const uploadUrlSchema = z
  .object({
    target: profileMediaTargetSchema,
    petId: z.string().uuid().optional(),
    fileName: z.string().min(1).max(255),
    contentType: contentTypeSchema,
    size: z.number().int().positive().max(PROFILE_MEDIA_MAX_BYTES),
  })
  .strict();

const cleanupSchema = z
  .object({
    target: profileMediaTargetSchema,
    objectKey: z.string().trim().min(1),
  })
  .strict();

const requireAuthenticatedUser = (req: Request): NonNullable<Request['user']> => {
  if (!req.user) {
    throw new Error('Authentication middleware did not attach a user');
  }
  return req.user;
};

export const createUploadUrl = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = uploadUrlSchema.parse(req.body);
    const result = await profileMediaService.createUploadUrl(requireAuthenticatedUser(req), {
      target: input.target,
      ...(input.petId !== undefined ? { petId: input.petId } : {}),
      originalName: input.fileName,
      contentType: input.contentType,
      size: input.size,
    });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const cleanupUpload = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = cleanupSchema.parse(req.body);
    await profileMediaService.removeUpload(
      requireAuthenticatedUser(req),
      input.target,
      input.objectKey,
    );
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
