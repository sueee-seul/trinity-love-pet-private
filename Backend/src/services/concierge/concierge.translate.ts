import type Anthropic from '@anthropic-ai/sdk';
import { textOfChoice, type MantleClient } from '../../config/mantle.js';
import type { TranslationModel } from '../../common/language/translate-lines.js';
import type { ConciergeAssistant } from './concierge.assistant.js';
import type { ClaudeMessagesClient } from './concierge.claude-assistant.js';

/**
 * Translation calls on the booking assistant's own model, for the fixed lines of a reply to a
 * guest who writes in a language other than English or Chinese (common/language). The same model
 * and account the assistant already uses, so a guest's words go nowhere new. Each call has no
 * tools and one short user message holding the lines as a JSON array.
 */

/** Room for a few translated lines plus the model's own thinking at low effort. */
const CLAUDE_MAX_TOKENS = 4000;
const OPENAI_MAX_TOKENS = 2000;

export const translateWithClaude = async (
  client: ClaudeMessagesClient,
  model: string,
  system: string,
  prompt: string,
): Promise<string> => {
  const response = await client.messages.create({
    model,
    max_tokens: CLAUDE_MAX_TOKENS,
    system,
    // Translating a few short lines needs little thought; low effort keeps the reply quick.
    output_config: { effort: 'low' },
    messages: [{ role: 'user', content: prompt }],
  });
  if (response.stop_reason === 'refusal') {
    throw new Error('The model declined to translate the lines');
  }
  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
};

export const translateWithOpenAi = async (
  client: MantleClient,
  model: string,
  system: string,
  prompt: string,
): Promise<string> => {
  const response = await client.complete({
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: prompt },
    ],
    max_tokens: OPENAI_MAX_TOKENS,
    temperature: 0,
  });
  const choice = response.choices[0];
  if (!choice) throw new Error('The model returned no choices');
  return textOfChoice(choice);
};

/** The assistant's translation call, or null for an assistant with no model (the rules one). */
export const translatorOf = (assistant: ConciergeAssistant): TranslationModel | null =>
  assistant.translate?.bind(assistant) ?? null;
