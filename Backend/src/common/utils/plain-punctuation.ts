/**
 * Takes em dashes and en dashes out of free text a language model wrote, before a person reads it.
 *
 * Wagstay copy uses plain punctuation only, and models reach for dashes far more than people here
 * write them. Every prompt asks for plain punctuation too, but a prompt is a request, not a
 * control, so model text passes through here on its way to a guest, a pet parent or a manager.
 *
 * Each dash becomes what it most likely meant:
 *
 *   1. Between two range ends (numbers, times, months or weekdays) it is a range, so it becomes
 *      " to " in English and "至" in Chinese.
 *   2. At the start or end of a line, or right beside other punctuation, it adds nothing, so it is
 *      dropped. This is also what keeps ", ." pairs and double spaces from appearing.
 *   3. Anywhere else it is a pause, so it becomes ", " in English and "，" in Chinese.
 *
 * English or Chinese is decided for each dash from the nearest letters around it, not from the page
 * locale, because a model answers in the language the person wrote in.
 *
 * This is for prose only. Never run it over JSON before it is parsed, identifiers or phone numbers.
 */

/**
 * U+2013 en dash, U+2014 em dash (two of them make the Chinese dash) and U+2015 horizontal bar,
 * which some Chinese code pages use for that same Chinese dash. Dashes with only spaces between
 * them count as one run, and spaces around the run go with it. Line breaks stay, because they
 * belong to the text around the dash.
 */
const DASH = String.raw`[\u2013\u2014\u2015]`;
const SPACE = String.raw`[^\S\r\n]`;
const DASH_RUN = new RegExp(String.raw`${SPACE}*${DASH}+(?:${SPACE}*${DASH}+)*${SPACE}*`, 'g');

/** How far either side of a dash to look for the letters that tell English from Chinese. */
const CONTEXT_WINDOW = 24;

const CHINESE_CHARACTER = /[\p{Script=Han}\u3000-\u303f\uff00-\uffef]/u;

/** Characters that belong to neither language, so they are skipped when choosing one. */
const LANGUAGE_NEUTRAL_CHARACTER = /[\s\d.,:;/%()'"[\]\u2013\u2014\u2015-]/;

const MONTH_NAME = String.raw`(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)`;
const WEEKDAY_NAME = String.raw`(?:mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)`;

/** "12", "9:00", "8am", "8 p.m.", "12日", "3点", "Oct" or "Friday" at the end of the text before a dash. */
const RANGE_START = new RegExp(
  String.raw`(?:\d(?:\s?[ap]\.?m\.?|[年月日号点时])?|\b${MONTH_NAME}\.?|\b${WEEKDAY_NAME}\.?)$`,
  'i',
);
/** A number, month or weekday at the start of the text after a dash. */
const RANGE_END = new RegExp(String.raw`^(?:\d|${MONTH_NAME}\b|${WEEKDAY_NAME}\b)`, 'i');

/** Sentence and clause marks. A dash beside one adds nothing: "Yes, [dash] sure" is "Yes, sure". */
const CLAUSE_PUNCTUATION = /[,.;:!?，。；：！？、]/;
const OPENING_MARK = /[(（[“‘]/;
const CLOSING_MARK = /[)）\]”’]/;
const LINE_BREAK = /[\r\n]/;

const nearestLanguageCharacter = (characters: readonly string[]): string | undefined =>
  characters.find((character) => !LANGUAGE_NEUTRAL_CHARACTER.test(character));

const isChineseAround = (before: string, after: string): boolean => {
  const characterBefore = nearestLanguageCharacter(Array.from(before).reverse());
  const characterAfter = nearestLanguageCharacter(Array.from(after));
  return [characterBefore, characterAfter].some(
    (character) => character !== undefined && CHINESE_CHARACTER.test(character),
  );
};

const replaceDashRun = (dashRun: string, offset: number, text: string): string => {
  const before = text.slice(Math.max(0, offset - CONTEXT_WINDOW), offset);
  const after = text.slice(offset + dashRun.length, offset + dashRun.length + CONTEXT_WINDOW);
  const chinese = isChineseAround(before, after);

  if (RANGE_START.test(before) && RANGE_END.test(after)) {
    return chinese ? '至' : ' to ';
  }

  // The start and the end of the text behave like line breaks.
  const characterBefore = before.at(-1) ?? '\n';
  const characterAfter = after.at(0) ?? '\n';
  if (
    LINE_BREAK.test(characterBefore) ||
    LINE_BREAK.test(characterAfter) ||
    OPENING_MARK.test(characterBefore) ||
    CLOSING_MARK.test(characterAfter) ||
    CLAUSE_PUNCTUATION.test(characterAfter)
  ) {
    return '';
  }
  if (CLAUSE_PUNCTUATION.test(characterBefore)) {
    return chinese ? '' : ' ';
  }
  return chinese ? '，' : ', ';
};

export const removeDashes = (text: string): string => text.replace(DASH_RUN, replaceDashRun);

type PlainObject = Readonly<Record<string, unknown>>;

const isPlainObject = (value: unknown): value is PlainObject => {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const removeDashesFromValue = (value: unknown): unknown => {
  if (typeof value === 'string') {
    return removeDashes(value);
  }
  if (Array.isArray(value)) {
    return value.map(removeDashesFromValue);
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, removeDashesFromValue(entry)]),
    );
  }
  return value;
};

/**
 * Runs `removeDashes` over every string inside an already parsed result, such as a stored review
 * investigation whose model text sits in many nested fields. The shape is kept exactly: only
 * string values change, and identifiers, enum values and ISO dates contain no dashes to change.
 */
export const removeDashesFromEveryString = <T>(value: T): T => removeDashesFromValue(value) as T;
