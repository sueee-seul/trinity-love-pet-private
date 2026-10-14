import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { generateObject } from 'ai';
import { createFeedback } from '../services/parent.feedback.service.js';
import { FEEDBACK_AUDIO_STORAGE_DIRECTORY } from '../services/feedback.audio.storage.js';
import {
  createFeedbackRecord,
  findOwnedPetFeedbackContext,
} from '../repositories/feedback.repository.js';

const { getManagerRecipientMock } = vi.hoisted(() => ({
  getManagerRecipientMock: vi.fn(),
}));

vi.mock('../services/staff.service.js', () => ({
  getManagerRecipient: getManagerRecipientMock,
}));

vi.mock('ai', () => ({
  generateObject: vi.fn().mockResolvedValue({
    object: {
      summary: 'LLM summary',
      insights: ['LLM insight'],
    },
  }),
}));

vi.mock('../repositories/feedback.repository.js', () => ({
  createFeedbackRecord: vi.fn().mockResolvedValue({
    uuid: '00000000-0000-4000-8000-000000000b16',
  }),
  findOwnedPetFeedbackContext: vi.fn().mockResolvedValue({
    parent_name: 'Ava Mitchell',
    pet_name: 'Biscuit',
  }),
}));

const ratings = {
  Professional: 5,
  Service: 4,
  Communication: 3,
  Safety: 2,
  Cost: 1,
};

const parentContext = {
  pet_uuid: '00000000-0000-4000-8000-000000000501',
  pet_owners_uuid: '00000000-0000-4000-8000-000000000101',
};

let savedAudioUrl: string | undefined;

describe('createFeedback', () => {
  beforeEach(() => {
    vi.mocked(createFeedbackRecord).mockClear();
    vi.mocked(findOwnedPetFeedbackContext).mockResolvedValue({
      parent_name: 'Ava Mitchell',
      pet_name: 'Biscuit',
    });
    vi.mocked(generateObject).mockClear();
    vi.mocked(generateObject).mockResolvedValue({
      object: {
        summary: 'LLM summary',
        insights: ['LLM insight'],
      },
    } as never);
    getManagerRecipientMock.mockResolvedValue({
      id: 'u1',
      name: 'Alice Manager',
      email: 'manager@wagstay.com',
    });
  });

  afterEach(async () => {
    if (savedAudioUrl) {
      await rm(path.join(FEEDBACK_AUDIO_STORAGE_DIRECTORY, path.basename(savedAudioUrl)), {
        force: true,
      });
      savedAudioUrl = undefined;
    }
  });

  it('builds a persisted feedback result with the calculated rating', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const feedback = await createFeedback(
      {
        ...parentContext,
        category: 'Suggestion',
        rating_details: ratings,
        raw_answer: 'Good.',
      },
      parentContext.pet_owners_uuid,
    );

    expect(feedback.rating).toBe(3);
    expect(feedback.category).toBe('Suggestion');
    expect(feedback.audio_url).toBeNull();
    expect(feedback.transcript).toBeNull();
    expect(feedback.ai_insights).toEqual({
      summary: 'LLM summary',
      insights: ['LLM insight'],
    });
    expect(feedback.uuid).toBe('00000000-0000-4000-8000-000000000b16');
    expect(createFeedbackRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        initial_timeline_step: 'captured',
        initial_event_payload: {
          workflow_type: 'suggestion',
          ownerId: 'u1',
          decision: null,
          evidenceSummary: null,
          decisionReason: null,
          nextReviewAt: null,
          actor: 'System',
        },
      }),
    );
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('manager@wagstay.com'));

    consoleSpy.mockRestore();
  });

  it('stores the audio file locally and returns its local URL', async () => {
    const feedback = await createFeedback(
      {
        ...parentContext,
        category: 'Praise',
        rating_details: ratings,
        raw_answer: 'Audio feedback.',
      },
      parentContext.pet_owners_uuid,
      {
        originalname: 'feedback.webm',
        buffer: Buffer.from('audio fixture'),
      } as Express.Multer.File,
    );

    expect(feedback.category).toBe('Praise');
    expect(createFeedbackRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        initial_timeline_step: 'submitted',
        initial_event_payload: { actor: 'System' },
      }),
    );
    expect(feedback.audio_url).toMatch(/^\/uploads\/feedback\/.+\.webm$/);
    savedAudioUrl = feedback.audio_url ?? undefined;
    const savedAudio = await readFile(
      path.join(FEEDBACK_AUDIO_STORAGE_DIRECTORY, path.basename(feedback.audio_url ?? '')),
    );
    expect(savedAudio.toString()).toBe('audio fixture');
  });

  it('does not create a feedback record when LLM analysis fails', async () => {
    vi.mocked(generateObject).mockRejectedValueOnce(new Error('provider unavailable'));

    await expect(
      createFeedback(
        {
          ...parentContext,
          category: 'Issue',
          rating_details: ratings,
          raw_answer: 'Provider failure feedback.',
        },
        parentContext.pet_owners_uuid,
      ),
    ).rejects.toMatchObject({
      code: 'FEEDBACK_INSIGHTS_UNAVAILABLE',
      statusCode: 503,
    });

    expect(createFeedbackRecord).not.toHaveBeenCalled();
  });

  it('rejects a pet that is not owned by the authenticated parent before AI work', async () => {
    vi.mocked(findOwnedPetFeedbackContext).mockResolvedValueOnce(null);

    await expect(
      createFeedback(
        {
          ...parentContext,
          category: 'Praise',
          rating_details: ratings,
          raw_answer: 'Not my pet.',
        },
        parentContext.pet_owners_uuid,
      ),
    ).rejects.toMatchObject({
      code: 'FEEDBACK_OWNERSHIP_FORBIDDEN',
      statusCode: 403,
    });

    expect(generateObject).not.toHaveBeenCalled();
    expect(createFeedbackRecord).not.toHaveBeenCalled();
  });
});
