import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../common/middlewares/error.middleware.js';
import { translateNotes } from '../services/care-note.translation.js';

/** One page's worth of notes: a stay's care answers or a pet's profile notes. */
const MAX_NOTES = 12;
/** Longer than any note field the parent forms accept. */
const MAX_NOTE_LENGTH = 1000;
const CHINESE = /[㐀-鿿豈-﫿]/;

const notesFrom = (body: unknown): string[] => {
  const texts = (body as { texts?: unknown } | null)?.texts;
  const valid =
    Array.isArray(texts) &&
    texts.length > 0 &&
    texts.length <= MAX_NOTES &&
    texts.every((text) => typeof text === 'string' && text.length <= MAX_NOTE_LENGTH);
  if (!valid) {
    throw new AppError(
      `texts must be 1 to ${MAX_NOTES} strings of at most ${MAX_NOTE_LENGTH} characters`,
      'VALIDATION_FAILED',
      422,
    );
  }
  return texts as string[];
};

/**
 * The English of notes a parent wrote in Chinese, for the English pages. A note with no Chinese
 * needs no translation and comes back null, so the model is only asked about Chinese text.
 */
export const translateToEnglish = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const notes = notesFrom(req.body);
    const chinese = notes.filter((note) => CHINESE.test(note));
    const english = chinese.length > 0 ? await translateNotes(chinese, 'en') : [];
    const byNote = new Map(chinese.map((note, index) => [note, english[index] ?? null]));
    res.status(200).json({ translations: notes.map((note) => byNote.get(note) ?? null) });
  } catch (error) {
    next(error);
  }
};
