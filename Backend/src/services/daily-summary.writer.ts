import type Anthropic from '@anthropic-ai/sdk';
import { removeDashes } from '../common/utils/plain-punctuation.js';
import { createBedrockMessagesClient } from '../config/bedrock.js';
import type { DayFacts } from './daily-summary.compose.js';
import type { SummaryLocale } from './daily-summary.words.js';

/**
 * The warm version of the daily update. The composer writes the record (every sentence true from
 * the tasks and the dose record); the model may only reword that record, in the same language,
 * for a parent to read. A checker then holds the words to the record: every number, every
 * medicine, the pet's name, the language. When the model is not set up, fails or strays, the
 * record is sent as it is. Scenario 11 outcome 3 asks for a warm plain summary that staff never
 * write; outcome 6 forbids saying a dose was given without a record.
 */

export interface WarmUpdateInput {
  facts: DayFacts;
  locale: SummaryLocale;
  /** The composer's sentences: the only facts the model may use. */
  record: string;
}

export interface UpdateWriter {
  write(input: WarmUpdateInput): Promise<string>;
}

export type UpdateAuthor = 'model' | 'record';

export interface WarmUpdate {
  body: string;
  writtenBy: UpdateAuthor;
}

/** A note longer than this is no longer a short daily update. */
export const WARM_UPDATE_MAX_CHARS = 700;

const LANGUAGE_NAME: Record<SummaryLocale, string> = { en: 'English', zh: 'Chinese' };

const promptFor = (locale: SummaryLocale): string =>
  `You write the daily update a pet boarding facility in New Zealand sends a pet parent. You get the facts of the day as plain sentences. Rewrite them as one warm, friendly note of two to five short sentences in ${LANGUAGE_NAME[locale]}.
Rules: say only what the sentences say; keep every number as digits exactly as given; name a medicine only as the sentences do, and never say a medicine was given unless the sentences say it was; add no activity, mood, health claim, advice or promise; address the parent as you and the pet by name; no greeting line, no sign-off, no emoji, no list, no dash used as punctuation. Return only the note.`;

const NUMBER = /\d+(?:[.:]\d+)?/g;
const LATIN_WORD = /[a-z]{3,}/gi;
const LINK_OR_ADDRESS = /https?:\/\/|www\.|@/i;
const CJK = /[㐀-鿿]/;
/** A clause ends at a sentence or clause mark in either script. */
const CLAUSE_END = /[.;,!?。；，！？]/;

const numbersIn = (text: string): Set<string> => new Set(text.match(NUMBER) ?? []);

const latinWordsIn = (text: string): Set<string> =>
  new Set((text.match(LATIN_WORD) ?? []).map((word) => word.toLowerCase()));

const escapeForPattern = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Words that claim a dose went in. "Not given" and its kin are removed first, so a faithful
 * "her Metacam was not given" passes and "she had her Metacam" does not. */
const GIVEN_WORDS = {
  en: /\b(?:given|had|took|taken|got|received|swallowed)\b/i,
  zh: /(?:已服用|服用了|吃了|服了|给了|喂了)/,
};
const NEGATED_GIVEN = {
  en: /\b(?:not|never|no|n't|without|refused|skipped)\s+(?:been\s+)?(?:given|had|taken|received|swallowed|got|it)\b/gi,
  zh: /(?:没有|未|没|不|拒绝)(?:服用|吃|给|喂|服)/g,
};

/** True when one clause of the note names the medicine and says it went in. */
const claimsDoseGiven = (note: string, name: string, locale: SummaryLocale): boolean => {
  const medicine = new RegExp(escapeForPattern(name), 'i');
  return note
    .replace(NEGATED_GIVEN[locale], '')
    .split(CLAUSE_END)
    .some((clause) => medicine.test(clause) && GIVEN_WORDS[locale].test(clause));
};

/**
 * Why a note may not go out, as short reasons for the log; an empty list means it is faithful to
 * the record. Numbers must come from the record, a medicine may be named only as the record names
 * it, the pet must be named, and the language must be the parent's.
 */
export const checkWarmUpdate = (text: string, input: WarmUpdateInput): string[] => {
  const problems: string[] = [];
  const note = text.trim();
  if (note.length === 0) problems.push('empty');
  if (note.length > WARM_UPDATE_MAX_CHARS) problems.push('too long');
  if (LINK_OR_ADDRESS.test(note)) problems.push('link or address');
  if (!note.includes(input.facts.petName)) problems.push('pet not named');

  const allowedNumbers = numbersIn(input.record);
  for (const number of numbersIn(note)) {
    if (!allowedNumbers.has(number)) problems.push(`number not in record: ${number}`);
  }

  const medicineNames = input.facts.doses
    .map((dose) => dose.medicineName.trim())
    .filter((name) => name.length > 0);
  for (const name of new Set(medicineNames)) {
    const named = new RegExp(escapeForPattern(name), 'i');
    if (named.test(note) && !named.test(input.record)) {
      problems.push(`medicine not in record: ${name}`);
      continue;
    }
    const givenToday = input.facts.doses.some(
      (dose) => dose.medicineName.trim() === name && dose.status === 'given',
    );
    if (!givenToday && claimsDoseGiven(note, name, input.locale)) {
      problems.push(`dose claimed given: ${name}`);
    }
  }

  // Names are the parent's own words in any script, and staff notes quoted from the record may be
  // English inside a Chinese note; the language check reads the rest.
  const ownWords = [input.facts.petName, ...medicineNames].reduce(
    (rest, word) => rest.split(word).join(''),
    note,
  );
  if (input.locale === 'zh') {
    if (!CJK.test(ownWords)) problems.push('not in Chinese');
    const quoted = latinWordsIn(input.record);
    if ([...latinWordsIn(ownWords)].some((word) => !quoted.has(word))) {
      problems.push('English words in a Chinese note');
    }
  }
  if (input.locale === 'en' && CJK.test(ownWords)) problems.push('not in English');
  return problems;
};

const textOf = (message: Anthropic.Message): string =>
  message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();

/** Rewords the record through Claude on Bedrock, with the shared client from config/bedrock.ts. */
export class BedrockUpdateWriter implements UpdateWriter {
  constructor(
    private readonly client: {
      messages: {
        create(params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message>;
      };
    },
    private readonly model: string,
  ) {}

  async write(input: WarmUpdateInput): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 600,
      system: promptFor(input.locale),
      messages: [{ role: 'user', content: input.record }],
    });
    return removeDashes(textOf(response));
  }
}

/** The configured writer, or null when Bedrock is not set up on this server. */
export const createUpdateWriter = (
  environment: Record<string, string | undefined> = process.env,
): UpdateWriter | null => {
  const bedrock = createBedrockMessagesClient(environment);
  return bedrock ? new BedrockUpdateWriter(bedrock.client, bedrock.model) : null;
};

/**
 * The note to send: the model's words when they pass the check, the record otherwise. A failure
 * is logged by its class only, never with the note or the record, which name the pet and its
 * medicines.
 */
export const warmDailyUpdate = async (
  facts: DayFacts,
  locale: SummaryLocale,
  record: string,
  writer: UpdateWriter | null = createUpdateWriter(),
): Promise<WarmUpdate> => {
  if (!writer) return { body: record, writtenBy: 'record' };
  const input: WarmUpdateInput = { facts, locale, record };
  try {
    const note = (await writer.write(input)).trim();
    const problems = checkWarmUpdate(note, input);
    if (problems.length === 0) return { body: note, writtenBy: 'model' };
    console.warn('[daily summary] model note failed the record check, record sent', {
      problems: problems.map((problem) => problem.split(':')[0]),
    });
  } catch (error: unknown) {
    console.error('[daily summary] model note failed, record sent', {
      error: error instanceof Error ? error.name : 'unknown',
    });
  }
  return { body: record, writtenBy: 'record' };
};
