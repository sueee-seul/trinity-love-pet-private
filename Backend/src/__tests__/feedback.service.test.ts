import { describe, expect, it, vi } from 'vitest';

const generateObjectMock = vi.fn();

vi.mock('ai', () => ({ generateObject: generateObjectMock }));
vi.mock('../services/llm.service.js', () => ({ llmProvider: 'test-model' }));

const { generateFeedbackInsights, systemPrompt } = await import('../services/feedback.service.js');

const ratingDetails = { Professional: 4, Service: 5, Communication: 4, Safety: 5, Cost: 3 };

describe('generateFeedbackInsights', () => {
  it('removes dashes from the summary and insights staff will read', async () => {
    generateObjectMock.mockResolvedValue({
      object: {
        summary: 'The parent was happy \u2014 the dog came home relaxed.',
        insights: [
          'Praised the staff\u2014\u2014especially Jessica.',
          'Liked the 9:00\u201317:00 hours.',
        ],
      },
    });

    await expect(
      generateFeedbackInsights({ ratingDetails, rawAnswer: 'Great stay.', category: 'Praise' }),
    ).resolves.toEqual({
      summary: 'The parent was happy, the dog came home relaxed.',
      insights: ['Praised the staff, especially Jessica.', 'Liked the 9:00 to 17:00 hours.'],
    });
  });

  it('names the brand and asks the model for plain punctuation', () => {
    expect(systemPrompt).toContain('for the Wagstay pet care platform');
    expect(systemPrompt).toContain('Use plain punctuation. Never use em dashes or en dashes.');
  });
});
