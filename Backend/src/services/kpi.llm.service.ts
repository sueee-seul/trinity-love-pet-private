import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { z } from 'zod';
import type { DailyKpiFigures } from './kpi.summary.service.js';

/*
 * KPI reports call Gemini through its OpenAI-compatible endpoint with KPI-only settings.
 * The shared LLM_* settings in llm.service.ts are not used or changed.
 */
const DEFAULT_KPI_LLM_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/';

const kpiLlmEnvironmentSchema = z.object({
  KPI_LLM_BASE_URL: z.string().trim().url().default(DEFAULT_KPI_LLM_BASE_URL),
  KPI_LLM_MODEL: z.string().trim().min(1),
  KPI_LLM_API_KEY: z.string().trim().min(1),
});

type KpiLlmEnvironment = Readonly<Record<string, string | undefined>>;

export interface KpiLlmSettings {
  baseUrl: string;
  model: string;
  apiKey: string;
}

export const readKpiLlmSettings = (
  environment: KpiLlmEnvironment = process.env,
): KpiLlmSettings => {
  const parsed = kpiLlmEnvironmentSchema.safeParse(environment);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'configuration'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid KPI LLM configuration: ${issues}`);
  }
  return {
    baseUrl: parsed.data.KPI_LLM_BASE_URL,
    model: parsed.data.KPI_LLM_MODEL,
    apiKey: parsed.data.KPI_LLM_API_KEY,
  };
};

/*
 * The daily summary only describes yesterday. Trends and comparisons belong to the weekly and
 * monthly reports, which compare fixed periods.
 */
const DAILY_SUMMARY_SYSTEM_PROMPT = [
  "You write the takeaway for a pet boarding manager reading yesterday's task figures.",
  'The manager already sees every figure as a number, so do not list or repeat them.',
  'In 1 or 2 short sentences, say what happened yesterday: usually how many tasks were not finished or ran overdue.',
  'Only describe yesterday. Do not compare it with other days, weeks or averages.',
  'Use at most two numbers. When fewer than 10 tasks were scheduled, use counts, not percentages.',
  'Overdue means finished, or still open, more than 30 minutes after the scheduled time.',
  'Use only the given figures. Do not guess causes, give advice, judge anyone, name staff or mention dates.',
  'If every task was finished on time, say that yesterday went smoothly.',
].join(' ');

/** Only team totals go to the LLM; staff names and the date stay out of the prompt. */
const toPromptFigures = (figures: DailyKpiFigures): Omit<DailyKpiFigures, 'date' | 'staff'> => ({
  scheduled: figures.scheduled,
  completed: figures.completed,
  completionRate: figures.completionRate,
  overdue: figures.overdue,
  incompleteAtDayEnd: figures.incompleteAtDayEnd,
});

export interface DailySummaryText {
  text: string;
  model: string;
}

/** One LLM call that turns the day's figures into summary text. */
export const writeDailySummaryText = async (
  figures: DailyKpiFigures,
  environment: KpiLlmEnvironment = process.env,
): Promise<DailySummaryText> => {
  const settings = readKpiLlmSettings(environment);
  const provider = createOpenAI({ baseURL: settings.baseUrl, apiKey: settings.apiKey });
  const { text } = await generateText({
    model: provider.chat(settings.model),
    system: DAILY_SUMMARY_SYSTEM_PROMPT,
    prompt: JSON.stringify(toPromptFigures(figures)),
  });
  const summary = text.trim();
  if (!summary) {
    throw new Error('The KPI LLM returned an empty summary');
  }
  return { text: summary, model: settings.model };
};
