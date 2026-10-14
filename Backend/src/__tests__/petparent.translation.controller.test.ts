import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const translation = vi.hoisted(() => ({ translateNotes: vi.fn() }));
vi.mock('../services/care-note.translation.js', () => translation);

import { translateToEnglish } from '../controllers/petparent.translation.controller.js';

const call = async (body: unknown): Promise<{ json: unknown; error: unknown }> => {
  let json: unknown = null;
  let error: unknown = null;
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn((value) => (json = value)) };
  const next = vi.fn((value: unknown) => (error = value));
  await translateToEnglish(
    { body } as Request,
    res as unknown as Response,
    next as unknown as NextFunction,
  );
  return { json, error };
};

// The English pages never show what a parent wrote in Chinese; they show its English.
describe('translating parent notes into English', () => {
  beforeEach(() => translation.translateNotes.mockReset());

  it('asks the model only about the notes with Chinese in them', async () => {
    translation.translateNotes.mockResolvedValue(['Likes to sleep in the day']);

    const { json } = await call({ texts: ['Kibble twice a day', '喜欢白天睡觉'] });

    expect(translation.translateNotes).toHaveBeenCalledWith(['喜欢白天睡觉'], 'en');
    expect(json).toEqual({ translations: [null, 'Likes to sleep in the day'] });
  });

  it('never calls the model for English notes', async () => {
    const { json } = await call({ texts: ['Kibble twice a day'] });

    expect(translation.translateNotes).not.toHaveBeenCalled();
    expect(json).toEqual({ translations: [null] });
  });

  it.each([
    ['no list', {}],
    ['an empty list', { texts: [] }],
    ['too many notes', { texts: Array.from({ length: 13 }, () => '猫') }],
    ['a note that is not text', { texts: [42] }],
    ['a note that is too long', { texts: ['猫'.repeat(1001)] }],
  ])('refuses %s', async (_name, body) => {
    const { error } = await call(body);

    expect(error).toMatchObject({ statusCode: 422, code: 'VALIDATION_FAILED' });
    expect(translation.translateNotes).not.toHaveBeenCalled();
  });
});
