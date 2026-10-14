import { generateText } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { writeDailySummaryText } from '../services/kpi.llm.service.js';

vi.mock('ai', () => ({
  generateText: vi.fn(),
}));

const ENVIRONMENT = { KPI_LLM_MODEL: 'test-model', KPI_LLM_API_KEY: 'test-key' };

describe('KPI LLM client', () => {
  it('sends only team totals, never staff names or the date', async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: ' None of the 42 tasks were finished. ',
    } as never);

    const result = await writeDailySummaryText(
      {
        date: '2026-09-30',
        scheduled: 42,
        completed: 1,
        completionRate: 2.4,
        overdue: 39,
        incompleteAtDayEnd: 41,
        staff: [{ name: 'aria.singh', overdue: 25, assigned: 25 }],
      },
      ENVIRONMENT,
    );

    const prompt = String(vi.mocked(generateText).mock.calls[0]?.[0].prompt);
    expect(prompt).not.toContain('aria.singh');
    expect(prompt).not.toContain('2026-09-30');
    expect(JSON.parse(prompt)).toEqual({
      scheduled: 42,
      completed: 1,
      completionRate: 2.4,
      overdue: 39,
      incompleteAtDayEnd: 41,
    });
    expect(result).toEqual({ text: 'None of the 42 tasks were finished.', model: 'test-model' });
  });

  it('fails clearly when the KPI LLM settings are missing', async () => {
    await expect(
      writeDailySummaryText(
        {
          date: '2026-09-30',
          scheduled: 1,
          completed: 1,
          completionRate: 100,
          overdue: 0,
          incompleteAtDayEnd: 0,
          staff: [],
        },
        {},
      ),
    ).rejects.toThrow('Invalid KPI LLM configuration');
  });
});
