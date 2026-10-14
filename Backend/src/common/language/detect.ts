import { z } from 'zod';

/**
 * Which language a chat reply should be written in, read from the message the person just sent.
 *
 * Many Wagstay parents are international students and migrants, so the two chats answer in the
 * language a person writes in, not only in the page's English or Chinese. Detection here is plain
 * Unicode script counting: it is free, instant and never wrong about Korean, Japanese, Thai and the
 * other scripts below. Languages written in Latin letters (English, Spanish, Vietnamese and so on)
 * all look the same to it, so it returns null for them and the caller falls back to the page
 * locale, or to the language a model already reading the message names.
 */

/** A lowercase BCP 47 primary language tag, such as "en", "zh", "ko" or "ja". */
export type ReplyLanguage = string;

/** The languages whose reply copy is written by hand; every other language is translated. */
export const BUILT_IN_LANGUAGES = ['en', 'zh'] as const;
export type BuiltInLanguage = (typeof BUILT_IN_LANGUAGES)[number];

export const isBuiltInLanguage = (tag: ReplyLanguage): tag is BuiltInLanguage =>
  (BUILT_IN_LANGUAGES as readonly string[]).includes(tag);

/** A tag a model may hand back; anything else (a name like "Korean", a region) is ignored. */
const languageTagSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z]{2,3}$/);

/** The tag in a model's answer, or null when it is missing or not a primary language tag. */
export const parseLanguageTag = (value: unknown): ReplyLanguage | null => {
  const parsed = languageTagSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

type Script =
  'hangul' | 'kana' | 'han' | 'thai' | 'arabic' | 'cyrillic' | 'devanagari' | 'latin' | 'other';

const SCRIPT_PATTERNS: readonly (readonly [Script, RegExp])[] = [
  ['hangul', /\p{Script=Hangul}/u],
  ['kana', /[\p{Script=Hiragana}\p{Script=Katakana}]/u],
  ['han', /\p{Script=Han}/u],
  ['thai', /\p{Script=Thai}/u],
  ['arabic', /\p{Script=Arabic}/u],
  ['cyrillic', /\p{Script=Cyrillic}/u],
  ['devanagari', /\p{Script=Devanagari}/u],
  ['latin', /\p{Script=Latin}/u],
];

const LETTER = /\p{L}/u;

/**
 * One Hangul syllable or Chinese character carries about as much as a short Latin word, so these
 * letters count three times. Without it, "Bella 오늘 어때요?" would be a tie between the pet's
 * Latin name and the Korean question around it.
 */
const SYLLABIC_WEIGHT = 3;
const SYLLABIC_SCRIPTS: ReadonlySet<Script> = new Set(['hangul', 'kana', 'han']);

/** Links and email addresses are Latin whatever language the message is in, so they are dropped. */
const LINKS = /\bhttps?:\/\/\S+|\bwww\.\S+|\S+@\S+\.\S+/gi;

const scriptOf = (letter: string): Script =>
  SCRIPT_PATTERNS.find(([, pattern]) => pattern.test(letter))?.[0] ?? 'other';

const weightedScriptCounts = (text: string): Map<Script, number> => {
  const counts = new Map<Script, number>();
  for (const character of text.replace(LINKS, ' ')) {
    if (!LETTER.test(character)) continue;
    const script = scriptOf(character);
    const weight = SYLLABIC_SCRIPTS.has(script) ? SYLLABIC_WEIGHT : 1;
    counts.set(script, (counts.get(script) ?? 0) + weight);
  }
  return counts;
};

const LANGUAGE_FOR_SCRIPT: Partial<Record<Script, ReplyLanguage>> = {
  hangul: 'ko',
  han: 'zh',
  thai: 'th',
  arabic: 'ar',
  cyrillic: 'ru',
  devanagari: 'hi',
};

/**
 * The language a message's script points to, or null when the script cannot tell (Latin letters,
 * or no letters at all, such as an emoji or a time). The script with the most weighted letters
 * decides, so a pet's Latin name inside a Korean sentence does not turn the reply English.
 * Japanese mixes kana with Chinese characters, so any kana makes the Chinese characters count as
 * Japanese; Chinese characters with no kana are read as Chinese.
 */
export const scriptLanguageOf = (text: string): ReplyLanguage | null => {
  const counts = weightedScriptCounts(text);
  const kana = counts.get('kana') ?? 0;
  if (kana > 0) {
    counts.set('kana', kana + (counts.get('han') ?? 0));
    counts.delete('han');
  }
  let winner: Script | null = null;
  let winnerCount = 0;
  for (const [script, count] of counts) {
    if (count > winnerCount) {
      winner = script;
      winnerCount = count;
    }
  }
  if (winner === 'kana') return 'ja';
  return winner ? (LANGUAGE_FOR_SCRIPT[winner] ?? null) : null;
};

/** The reply language for a message: its script's language, or the fallback (the page locale). */
export const detectMessageLanguage = (text: string, fallback: ReplyLanguage): ReplyLanguage =>
  scriptLanguageOf(text) ?? fallback;

const LANGUAGE_NAMES = new Intl.DisplayNames(['en'], { type: 'language' });

/** "Korean (ko)", for prompts: a model follows a name more reliably than a bare code. */
export const describeLanguage = (tag: ReplyLanguage): string => {
  const name = LANGUAGE_NAMES.of(tag);
  return name && name !== tag ? `${name} (${tag})` : `the language with code ${tag}`;
};
