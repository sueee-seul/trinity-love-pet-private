import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { z } from 'zod';
import { readKpiLlmSettings } from './kpi.llm.service.js';
import type { KeyNumberChange } from './kpi.report.compare.js';
import type { KpiReportType } from './kpi.report.periods.js';

/** A staff-written delay reason (tasks.issue) with the task's category. */
export interface DelayReasonInput {
  category: string;
  reason: string;
}

export interface DelayReasonTheme {
  theme: string;
  count: number;
  example: string;
}

export interface ReportWritingInput {
  type: KpiReportType;
  periodLabel: string;
  keyNumbers: KeyNumberChange[];
  trends: string[];
  movers: string[];
  delayReasons: DelayReasonInput[];
}

export interface ReportWriting {
  headline: string;
  delayReasons: DelayReasonTheme[];
  model: string;
}

type KpiLlmEnvironment = Readonly<Record<string, string | undefined>>;

const replySchema = z.object({
  headline: z.string().trim().min(1),
  themes: z
    .array(z.object({ theme: z.string().trim().min(1), reasonIds: z.array(z.number().int()) }))
    .default([]),
});

type Reply = z.infer<typeof replySchema>;

const SYSTEM_PROMPT = [
  'You write the summary of a task report for the manager of a pet boarding facility.',
  'Use only the given JSON. Do not add, estimate or recalculate figures, give advice or judge anyone.',
  'Reply with JSON only, in this shape: {"headline": string, "themes": [{"theme": string, "reasonIds": number[]}]}.',
  'headline: 2 or 3 plain English sentences on what changed most since the previous period, using at most three numbers.',
  'Rates are percentages and their changes are percentage points: write "down 7.2 points to 79%", never "decreased by 7.2 percent".',
  'themes: group the staff-written delay reasons by cause into short themes, such as "Pet refused food or medication" or "Weather".',
  'Put every reason id in exactly one theme. Put reasons too vague to group, such as test text, in a theme named "Unclear".',
  'If there are no delay reasons, return an empty themes list.',
].join(' ');

const toPromptInput = (input: ReportWritingInput): Record<string, unknown> => ({
  report: `${input.type} report for ${input.periodLabel}`,
  keyNumbers: input.keyNumbers.map(({ label, unit, current, previous, change }) => ({
    label,
    unit,
    current,
    previous,
    change,
  })),
  trendWarnings: input.trends,
  biggestMovers: input.movers,
  delayReasons: input.delayReasons.map(({ category, reason }, id) => ({ id, category, reason })),
});

/** Reads the JSON object out of the reply, allowing a ```json fence around it. */
const parseReply = (text: string): Reply => {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) {
    throw new Error('The KPI report LLM reply had no JSON object');
  }
  return replySchema.parse(JSON.parse(text.slice(start, end + 1)));
};

/** Counts are taken from the reason ids, not from the LLM; unused reasons go to "Other". */
const toThemes = (themes: Reply['themes'], reasons: DelayReasonInput[]): DelayReasonTheme[] => {
  const used = new Set<number>();
  const grouped = themes.flatMap(({ theme, reasonIds }) => {
    const ids = [...new Set(reasonIds)].filter(
      (id) => id >= 0 && id < reasons.length && !used.has(id),
    );
    ids.forEach((id) => used.add(id));
    const first = ids[0];
    return first === undefined
      ? []
      : [{ theme, count: ids.length, example: reasons[first]?.reason ?? '' }];
  });
  const leftover = reasons.filter((_, id) => !used.has(id));
  if (leftover.length > 0) {
    grouped.push({ theme: 'Other', count: leftover.length, example: leftover[0]?.reason ?? '' });
  }
  return grouped.sort((a, b) => b.count - a.count);
};

/** One LLM call per report: the headline and the delay reasons grouped into themes. */
export const writeKpiReport = async (
  input: ReportWritingInput,
  environment: KpiLlmEnvironment = process.env,
): Promise<ReportWriting> => {
  const settings = readKpiLlmSettings(environment);
  const provider = createOpenAI({ baseURL: settings.baseUrl, apiKey: settings.apiKey });
  const { text } = await generateText({
    model: provider.chat(settings.model),
    system: SYSTEM_PROMPT,
    prompt: JSON.stringify(toPromptInput(input)),
  });
  const reply = parseReply(text);
  return {
    headline: reply.headline,
    delayReasons: toThemes(reply.themes, input.delayReasons),
    model: settings.model,
  };
};
