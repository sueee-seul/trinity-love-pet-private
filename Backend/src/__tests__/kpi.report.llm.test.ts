import { generateText } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { writeKpiReport, type ReportWritingInput } from '../services/kpi.report.llm.js';

vi.mock('ai', () => ({
  generateText: vi.fn(),
}));

const ENVIRONMENT = { KPI_LLM_MODEL: 'test-model', KPI_LLM_API_KEY: 'test-key' };

const INPUT: ReportWritingInput = {
  type: 'weekly',
  periodLabel: '28 Sep to 4 Oct',
  keyNumbers: [],
  trends: [],
  movers: [],
  delayReasons: [
    { category: 'Walking', reason: 'Heavy rain all afternoon.' },
    { category: 'Medical', reason: 'Mochi would not take the tablet.' },
    { category: 'Walking', reason: 'Held back by a thunderstorm.' },
    { category: 'Other', reason: 'Test-093022' },
  ],
};

describe('KPI report writing', () => {
  it('reads a fenced JSON reply and counts themes from the reason ids', async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: '```json\n{"headline":"Overdue rose this week.","themes":[{"theme":"Weather","reasonIds":[0,2]},{"theme":"Pet refused","reasonIds":[1,9]}]}\n```',
    } as never);

    const writing = await writeKpiReport(INPUT, ENVIRONMENT);

    expect(writing).toEqual({
      headline: 'Overdue rose this week.',
      delayReasons: [
        { theme: 'Weather', count: 2, example: 'Heavy rain all afternoon.' },
        { theme: 'Pet refused', count: 1, example: 'Mochi would not take the tablet.' },
        { theme: 'Other', count: 1, example: 'Test-093022' },
      ],
      model: 'test-model',
    });
    const prompt = JSON.parse(String(vi.mocked(generateText).mock.calls[0]?.[0].prompt));
    expect(prompt.delayReasons[1]).toEqual({
      id: 1,
      category: 'Medical',
      reason: 'Mochi would not take the tablet.',
    });
  });

  it('fails when the reply has no JSON object', async () => {
    vi.mocked(generateText).mockResolvedValue({ text: 'Sorry, I cannot help.' } as never);

    await expect(writeKpiReport(INPUT, ENVIRONMENT)).rejects.toThrow('no JSON object');
  });
});
