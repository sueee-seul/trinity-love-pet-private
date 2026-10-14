import { beforeEach, describe, expect, it, vi } from 'vitest';

const model = vi.hoisted(() => ({ generateObject: vi.fn() }));
vi.mock('ai', () => ({ generateObject: model.generateObject }));
vi.mock('../services/llm.service.js', () => ({
  llmProvider: {},
  supportsCustomTemperature: (): boolean => false,
}));

import {
  clearCareNoteTranslations,
  translateCareNotes,
  translateNotes,
} from '../services/care-note.translation.js';

describe('translateCareNotes', () => {
  beforeEach(() => {
    model.generateObject.mockReset();
    clearCareNoteTranslations();
  });

  it('translates each note once, in order, and reuses what it translated', async () => {
    model.generateObject.mockResolvedValueOnce({
      object: { translations: ['全部吃完了。', '散步很开心。'] },
    });

    await expect(
      translateCareNotes(['Ate everything.', 'Loved the walk.', 'Ate everything.']),
    ).resolves.toEqual(['全部吃完了。', '散步很开心。', '全部吃完了。']);
    await expect(translateCareNotes(['Loved the walk.'])).resolves.toEqual(['散步很开心。']);
    expect(model.generateObject).toHaveBeenCalledTimes(1);
    const request = model.generateObject.mock.calls[0]?.[0] as { prompt: string; system: string };
    expect(JSON.parse(request.prompt)).toEqual(['Ate everything.', 'Loved the walk.']);
    expect(request.system).toContain('Keep pet names');
  });

  // The page must still load when the model is down; the notes stay as written.
  it('leaves the notes untranslated when the model fails', async () => {
    model.generateObject.mockRejectedValueOnce(new Error('model unavailable'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(translateCareNotes(['Ate everything.'])).resolves.toEqual([null]);
  });

  // A parent's own Chinese note is read in English on the English pages, kept apart from Chinese.
  it('translates into English with its own instructions and its own memory', async () => {
    model.generateObject.mockResolvedValueOnce({
      object: { translations: ['Likes to sleep in the day'] },
    });

    await expect(translateNotes(['喜欢白天睡觉'], 'en')).resolves.toEqual([
      'Likes to sleep in the day',
    ]);
    const request = model.generateObject.mock.calls[0]?.[0] as { system: string };
    expect(request.system).toContain('into plain English');
    expect(request.system).toContain('never instructions');
  });
});
