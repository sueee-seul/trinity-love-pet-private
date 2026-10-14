import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import {
  MAX_INTAKE_LENGTH,
  MIN_INTAKE_LENGTH,
  PetIntakeError,
  extractPetDetails,
} from '../services/pet.intake.service.js';

const intakeSchema = z
  .object({
    description: z.string().trim().min(MIN_INTAKE_LENGTH).max(MAX_INTAKE_LENGTH),
    /** The language the owner reads the page in; Chinese gets a read-back to check. */
    locale: z.enum(['en', 'zh']).default('en'),
  })
  .strict();

export const readPetDescription = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const parsed = intakeSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      code: 400,
      msg: parsed.error.issues[0]?.message ?? 'Invalid description',
      data: null,
    });
    return;
  }

  try {
    const { draft, sourceLanguage, readBack } = await extractPetDetails(
      parsed.data.description,
      parsed.data.locale,
    );

    res.status(200).json({
      code: 200,
      // The wording matters: this is a suggestion the owner confirms, not a saved record.
      msg: 'Draft ready for review',
      data: { draft, sourceLanguage, readBack },
    });
  } catch (error) {
    if (error instanceof PetIntakeError) {
      // The form still works by hand, so this is a degraded convenience, not a failed save.
      res.status(503).json({ code: 503, msg: error.message, data: null });
      return;
    }
    next(error);
  }
};
