import {
  CONCIERGE_MAX_PETS,
  type ConciergeNeeds,
  type ConciergePetSize,
  type ConciergeSpecies,
} from '../../contracts/concierge.contract.js';
import type { ConciergeNeedsPatch } from './concierge.needs.js';

/**
 * Keyword extraction for the rules assistant, in English and Chinese.
 *
 * It is deliberately modest: it recognises the phrasings a guest actually types or dictates
 * ("2 dogs", "两只猫", "12/10 to 15/10", "12 to 15 October", "the 12th of October to the 15th",
 * "10月12日到15日", "2026年10月12日到2026年10月15日") and leaves anything else for the checklist.
 * A missed phrase costs one extra question; a wrong guess would cost a wrong quote, so when in
 * doubt it extracts nothing. Relative phrases such as "next weekend" are never guessed, a detail
 * that could belong to any of several pets is asked about, and dates already set are only replaced
 * by a message that is clearly about the stay.
 */

/** A detail that belongs to one pet of several, when the message does not say which one. */
export type AmbiguousCare = 'medication' | 'firstTime';

const CHINESE_NUMERALS: Record<string, number> = {
  一: 1,
  两: 2,
  二: 2,
  三: 3,
  四: 4,
};

const ENGLISH_NUMERALS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4 };

const SPECIES_WORDS: Array<{ species: ConciergeSpecies; pattern: RegExp }> = [
  { species: 'dog', pattern: /\b(dogs?|pupp(?:y|ies)|pups?)\b|狗|犬|汪/i },
  { species: 'cat', pattern: /\b(cats?|kittens?|kitt(?:y|ies))\b|猫|喵/i },
];

const SIZE_WORDS: Array<{ size: ConciergePetSize; pattern: RegExp }> = [
  { size: 'small', pattern: /\b(small|little|tiny|toy)\b|小型|小狗|小只/i },
  { size: 'medium', pattern: /\b(medium|mid-?sized?)\b|中型|中等/i },
  { size: 'large', pattern: /\b(large|big|giant)\b|大型|大狗|大只/i },
];

const BOARDING_INTENT =
  /\b(board(?:ing)?|stay|kennel|book|holiday|away|trip)\b|寄养|托管|住|预约|出差|旅行|出门/i;
const MEDICATION_WORD =
  /\b(medication|medicine|meds|pills?|tablets?|insulin)\b|吃药|用药|药物|喂药/i;
/** Clear "no medication" statements. */
const MEDICATION_NO =
  /\b(?:no (?:meds|medication|medicine|pills|tablets)|not on (?:any )?(?:meds|medication|medicine|pills)|none of them (?:needs?|takes?|is on|are on)|neither (?:of them )?(?:needs?|takes?)|(?:does|do)n['’]?t (?:need|take) (?:any )?(?:meds|medication|medicine|pills|tablets))\b|不用吃药|没有(?:吃)?药|不吃药|无需用药|不需要(?:吃药|用药)|都不用吃药/i;
/** Any other negation near a medication word ("isn't on meds", "不需要药物"): not a yes. */
const MEDICATION_NEGATED =
  /\b(?:no|not|none|never|without|\w+n['’]?t)\b[^.!?;]{0,30}\b(?:medication|medicine|meds|pills?|tablets?|insulin)\b|(?:不|没|无|别)[^，。！？,.!?]{0,4}(?:吃药|用药|药物|喂药)/i;
const FIRST_TIME = /\bfirst (?:time|stay)\b|第一次/i;
/** "one needs meds", "one of them is on pills", "only one is new here", "其中一只要吃药". */
const SINGLES_ONE_OUT =
  /\b(?:only |just )?(?:one|1)(?: of (?:them|the \w+|my \w+|our \w+))? (?:needs|takes|is|has|gets|requires|will)\b|\bone of (?:them|the \w+|my \w+|our \w+)\b|其中一只|其中一个|有一只|一只(?:要|需要|得|在|是)/i;
/** "both", "all of them", "they all", "两只都": the detail is for every pet. */
const COVERS_EVERY_PET =
  /\b(?:both|all of them|each of them|they all|they both|they|all (?:two|three|four|\d))\b|[两三四]只都|都要|都需要|每只|它们都|他们都/i;
/** "she", "he", "it": one pet, but which one is not said. */
const ONE_PET_PRONOUN = /\b(?:she|he|it|her|his)\b|[它她他](?!们)/i;
/** "the dog", "my cats", "狗狗要": a species named as the one a detail is about. */
const SPECIES_TARGETS: Array<{ species: ConciergeSpecies; pattern: RegExp }> = [
  {
    species: 'dog',
    pattern: /\b(?:the|my|our)\s+(?:dog|puppy|pup)(s|ies)?\b|狗狗?(们)?(?:要|需要|得|在|是)/i,
  },
  {
    species: 'cat',
    pattern: /\b(?:the|my|our)\s+(?:cat|kitten|kitty)(s|ies)?\b|猫咪?(们)?(?:要|需要|得|在|是)/i,
  },
];
const WALKS = /\bwalks?|walking\b|遛/i;
const GROOMING = /\b(groom(?:ing)?|bath|wash|brush)\b|洗澡|美容|梳毛/i;
const PLAYTIME = /\b(play(?:time)?|social(?:ise|ize|ising|izing)?)\b|玩|陪玩/i;
/** Words that show a message is about the stay's dates, so it may replace dates already set. */
const STAY_WORDING =
  /\b(?:from|to|until|till|through|thru|between|for|nights?|weeks?|fortnight|stay|instead|change|actually)\b|到|至|住|晚|周|改|换/i;

const MONTH_NUMBERS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};
const MONTH_WORD = String.raw`(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)`;
const MONTH = String.raw`(${MONTH_WORD})\.?`;
const DAY = String.raw`(\d{1,2})(?:st|nd|rd|th)?`;
/** An end day that is not really a day: "3 dogs", "4 nights", "5pm", "10:30". */
const DAY_END = String.raw`(\d{1,2})(?:st|nd|rd|th)?(?!\d|:|\s*(?:dogs?|cats?|pets?|pupp(?:y|ies)|kittens?|nights?|weeks?|days?|am|pm|hours?)\b)`;
const RANGE = String.raw`\s*(?:-|\u2013|\u2014|~|\bto\b|\buntil\b|\btill\b|\bthrough\b|\bthru\b)\s*`;
const THE = String.raw`(?:the\s+)?`;
const OF = String.raw`(?:\s+of)?\s+`;

/**
 * "12 to 15 October", "12 Oct - 15 Nov", "the 12th of October to the 15th of October". It never
 * starts right after a month name, so "October 12 to 15 November" is read month first below.
 */
const DAY_MONTH_RANGE = new RegExp(
  String.raw`(?<!${MONTH_WORD}\.?\s+)\b${THE}${DAY}(?:${OF}${MONTH})?${RANGE}${THE}${DAY}${OF}${MONTH}\b`,
  'i',
);
/** "12 October to 15", "from the 12th of October to the 15th": the stay ends in the same month. */
const DAY_MONTH_TO_DAY = new RegExp(
  String.raw`\b${THE}${DAY}${OF}${MONTH}${RANGE}${THE}${DAY_END}\b`,
  'i',
);
/** "October 12 to 15", "Oct 12th - Oct 15th", "October 12 to 15 November". */
const MONTH_DAY_RANGE = new RegExp(
  String.raw`\b${MONTH}\s+${THE}${DAY}${RANGE}(?:${MONTH}\s+)?${THE}${DAY_END}(?:${OF}${MONTH})?\b`,
  'i',
);
/**
 * NZ day-first slash dates, with an optional year: "12/10", "12/10/2027". Not a fraction ("1/2
 * cup"), not "24/7", not part of a longer number run such as "2026/11/01".
 */
const SLASH_DATE =
  /(?<![\d/])(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?(?![\d/])(?!\s*(?:cups?|scoops?|cans?|tins?|tablets?|pills?|of\b|care|service|hours?|days?|servings?))/gi;
const YEAR_FIRST_DATE = /(?<!\d)(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?!\d)/g;
const CHINESE_RANGE =
  /(?:(\d{4})年)?(\d{1,2})月(\d{1,2})[日号]?\s*(?:到|至|-|~|\u2014|\u2013)\s*(?:(?:(\d{4})年)?(\d{1,2})月)?(\d{1,2})(?![\d年月])[日号]?/;
const CHINESE_DATE = /(?:(\d{4})年)?(\d{1,2})月(\d{1,2})(?![\d年月])[日号]?/g;

const monthNumber = (word: string | undefined): number | null =>
  word ? (MONTH_NUMBERS[word.slice(0, 3).toLowerCase()] ?? null) : null;

const pad = (value: number): string => String(value).padStart(2, '0');

const toIsoDate = (year: number, month: number, day: number): string | null => {
  const date = new Date(Date.UTC(year, month - 1, day));
  const valid =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return valid ? `${year}-${pad(month)}-${pad(day)}` : null;
};

/** A day/month with no year means the next occurrence on or after today. */
const resolveYear = (month: number, day: number, today: string): string | null => {
  const [yearText, monthText, dayText] = today.split('-');
  const year = Number(yearText);
  const todayKey = Number(monthText) * 100 + Number(dayText);
  const candidateYear = month * 100 + day >= todayKey ? year : year + 1;
  return toIsoDate(candidateYear, month, day);
};

/** The first two dates found, in order, as a stay range. */
const firstPair = (dates: string[]): { startDate: string; endDate: string } | null => {
  const [startDate, endDate] = dates;
  return startDate && endDate ? { startDate, endDate } : null;
};

type DateRange = { startDate: string; endDate: string };

const rangeFrom = (
  start: { day: string | undefined; month: number | null },
  end: { day: string | undefined; month: number | null },
  today: string,
): DateRange | null => {
  if (!start.day || !end.day || start.month === null || end.month === null) {
    return null;
  }
  const startDate = resolveYear(start.month, Number(start.day), today);
  const endDate = resolveYear(end.month, Number(end.day), today);
  return startDate && endDate ? { startDate, endDate } : null;
};

/** "24/7 care" is about attention, not dates. */
const withoutNonDates = (text: string): string => text.replace(/\b24\s*\/\s*7\b/g, ' ');

/** English month names and abbreviations, day first (as NZ writes) or month first. */
const extractEnglishMonthRange = (text: string, today: string): DateRange | null => {
  const dayMonth = text.match(DAY_MONTH_RANGE);
  if (dayMonth) {
    const endMonth = monthNumber(dayMonth[4]);
    return rangeFrom(
      { day: dayMonth[1], month: monthNumber(dayMonth[2]) ?? endMonth },
      { day: dayMonth[3], month: endMonth },
      today,
    );
  }
  const monthDay = text.match(MONTH_DAY_RANGE);
  if (monthDay) {
    const startMonth = monthNumber(monthDay[1]);
    return rangeFrom(
      { day: monthDay[2], month: startMonth },
      {
        day: monthDay[4],
        month: monthNumber(monthDay[3]) ?? monthNumber(monthDay[5]) ?? startMonth,
      },
      today,
    );
  }
  const dayMonthToDay = text.match(DAY_MONTH_TO_DAY);
  if (dayMonthToDay) {
    const month = monthNumber(dayMonthToDay[2]);
    return rangeFrom({ day: dayMonthToDay[1], month }, { day: dayMonthToDay[3], month }, today);
  }
  return null;
};

const slashDate = (match: RegExpMatchArray, today: string): string | null => {
  const day = Number(match[1]);
  const month = Number(match[2]);
  return match[3] ? toIsoDate(Number(match[3]), month, day) : resolveYear(month, day, today);
};

/** "2026年10月12日到2026年10月15日", "10月12日到15号", "12月28日到1月3日". */
const extractChineseRange = (text: string, today: string): DateRange | null => {
  const match = text.match(CHINESE_RANGE);
  if (!match) return null;
  const [, startYearText, startMonthText, startDayText, endYearText, endMonthText, endDayText] =
    match;
  const startMonth = Number(startMonthText);
  const startDay = Number(startDayText);
  const endMonth = endMonthText ? Number(endMonthText) : startMonth;
  const endDay = Number(endDayText);
  const startDate = startYearText
    ? toIsoDate(Number(startYearText), startMonth, startDay)
    : resolveYear(startMonth, startDay, today);
  let endDate: string | null;
  if (endYearText) {
    endDate = toIsoDate(Number(endYearText), endMonth, endDay);
  } else if (startYearText) {
    const sameYear = endMonth * 100 + endDay >= startMonth * 100 + startDay;
    endDate = toIsoDate(Number(startYearText) + (sameYear ? 0 : 1), endMonth, endDay);
  } else {
    endDate = resolveYear(endMonth, endDay, today);
  }
  return startDate && endDate ? { startDate, endDate } : null;
};

export const extractDateRange = (rawText: string, today: string): DateRange | null => {
  const text = withoutNonDates(rawText);
  const yearFirst = [...text.matchAll(YEAR_FIRST_DATE)]
    .map((m) => toIsoDate(Number(m[1]), Number(m[2]), Number(m[3])))
    .filter((d): d is string => d !== null);
  const yearFirstRange = firstPair(yearFirst);
  if (yearFirstRange) {
    return yearFirstRange;
  }

  // New Zealand writes day first: 12/10 means 12 October.
  const dayMonth = [...text.matchAll(SLASH_DATE)]
    .map((m) => slashDate(m, today))
    .filter((d): d is string => d !== null);
  const dayMonthRange = firstPair(dayMonth);
  if (dayMonthRange) {
    return dayMonthRange;
  }

  const english = extractEnglishMonthRange(text, today);
  if (english) {
    return english;
  }

  const chinese = extractChineseRange(text, today);
  if (chinese) {
    return chinese;
  }
  return extractStartAndDuration(text, today);
};

const DURATION_NUMBERS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  一: 1,
  两: 2,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
};

const countWord = (word: string | undefined): number | null => {
  if (!word) return null;
  const value = Number(word) || DURATION_NUMBERS[word.toLowerCase()];
  return value && value > 0 ? value : null;
};

/**
 * "for 3 nights", "a week", "a fortnight", "住3晚", "一周". Days ("3 天") are left alone: a
 * three-day stay can mean two nights or three, and a wrong guess changes the price.
 */
const extractNights = (text: string): number | null => {
  const nights = text.match(
    /\b(\d{1,2}|a|an|one|two|three|four|five|six|seven|eight|nine|ten)\s+nights?\b|(\d{1,2}|[一两二三四五六七八九十])\s*晚/i,
  );
  const nightCount = countWord(nights?.[1] ?? nights?.[2]);
  if (nightCount) return nightCount;
  const weeks = text.match(
    /\b(\d|a|one|two|three|four)\s+weeks?\b|(\d|[一两二三四])\s*(?:周|个星期|个礼拜)/i,
  );
  const weekCount = countWord(weeks?.[1] ?? weeks?.[2]);
  if (weekCount) return weekCount * 7;
  return /\ba fortnight\b|\bfortnight\b/i.test(text) ? 14 : null;
};

/** Exactly one calendar date in the message, in any of the formats above. */
const extractSingleDate = (text: string, today: string): string | null => {
  const found: string[] = [];
  for (const m of text.matchAll(YEAR_FIRST_DATE)) {
    const date = toIsoDate(Number(m[1]), Number(m[2]), Number(m[3]));
    if (date) found.push(date);
  }
  for (const m of text.matchAll(SLASH_DATE)) {
    const date = slashDate(m, today);
    if (date) found.push(date);
  }
  for (const m of text.matchAll(new RegExp(String.raw`\b${THE}${DAY}${OF}${MONTH}\b`, 'gi'))) {
    const month = monthNumber(m[2]);
    const date = month === null ? null : resolveYear(month, Number(m[1]), today);
    if (date) found.push(date);
  }
  for (const m of text.matchAll(new RegExp(String.raw`\b${MONTH}\s+${THE}${DAY_END}\b`, 'gi'))) {
    const month = monthNumber(m[1]);
    const date = month === null ? null : resolveYear(month, Number(m[2]), today);
    if (date) found.push(date);
  }
  for (const m of text.matchAll(CHINESE_DATE)) {
    const month = Number(m[2]);
    const day = Number(m[3]);
    const date = m[1] ? toIsoDate(Number(m[1]), month, day) : resolveYear(month, day, today);
    if (date) found.push(date);
  }
  const distinct = Array.from(new Set(found));
  return distinct.length === 1 ? (distinct[0] ?? null) : null;
};

const addDays = (isoDate: string, days: number): string => {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

/** "From 12 October for 3 nights", "10月12日开始住一周". */
const extractStartAndDuration = (text: string, today: string): DateRange | null => {
  const nights = extractNights(text);
  if (!nights) return null;
  const startDate = extractSingleDate(text, today);
  return startDate ? { startDate, endDate: addDays(startDate, nights) } : null;
};

const countBefore = (text: string, speciesPattern: RegExp): number | null => {
  const source = speciesPattern.source;
  const english = new RegExp(`\\b(\\d|a|an|one|two|three|four)\\s+(?:\\w+\\s+)?(?:${source})`, 'i');
  const englishMatch = text.match(english);
  const englishToken = englishMatch?.[1]?.toLowerCase();
  if (englishToken) {
    return Number(englishToken) || ENGLISH_NUMERALS[englishToken] || null;
  }
  const chinese = new RegExp(`([一两二三四\\d])\\s*[只条个]\\s*(?:${source})`);
  const chineseMatch = text.match(chinese);
  const chineseToken = chineseMatch?.[1];
  if (chineseToken) {
    return Number(chineseToken) || CHINESE_NUMERALS[chineseToken] || null;
  }
  return null;
};

/**
 * Pets named in this message. With no pets known yet, they become the pet list. Once pets are
 * known, a message only fills in species that are still open ("and the other one is a cat"); it
 * never shrinks the list or overwrites a species already set, and anything unclear is left alone.
 */
const extractPets = (
  text: string,
  current: ConciergeNeeds,
): Pick<ConciergeNeedsPatch, 'petCount' | 'pets'> => {
  const mentioned = SPECIES_WORDS.filter(({ pattern }) => pattern.test(text));
  if (mentioned.length === 0) {
    return {};
  }
  const groups = mentioned.map(({ species, pattern }) => ({
    species,
    count: countBefore(text, pattern) ?? 1,
  }));

  if (current.pets.length === 0) {
    const petCount = Math.min(
      groups.reduce((sum, group) => sum + group.count, 0),
      CONCIERGE_MAX_PETS,
    );
    const pets: NonNullable<ConciergeNeedsPatch['pets']> = [];
    for (const group of groups) {
      for (let i = 0; i < group.count && pets.length < petCount; i += 1) {
        pets.push({ index: pets.length, species: group.species });
      }
    }
    return { petCount, pets };
  }

  const open = current.pets.flatMap((pet, index) => (pet.species === null ? [index] : []));
  if (open.length === 0) {
    return {};
  }
  const missing = groups.flatMap((group) => {
    const known = current.pets.filter((pet) => pet.species === group.species).length;
    return Array.from({ length: Math.max(group.count - known, 0) }, () => group.species);
  });
  const fitsOpenSlots =
    missing.length > 0 && (missing.length === open.length || new Set(missing).size === 1);
  if (!fitsOpenSlots || missing.length > open.length) {
    return {};
  }
  const pets = missing.map((species, position) => ({
    index: open[position] ?? 0,
    species,
  }));
  return { petCount: current.pets.length, pets };
};

/** Which pets are called by name in this message ("Luna needs her pills"). */
const petsNamedIn = (text: string, needs: ConciergeNeeds): number[] => {
  const lower = text.toLowerCase();
  return needs.pets.flatMap((pet, index) => {
    const name = pet.name?.trim().toLowerCase();
    if (!name || name.length < 2) return [];
    const latin = /^[a-z0-9 '-]+$/.test(name);
    const found = latin
      ? new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text)
      : lower.includes(name);
    return found ? [index] : [];
  });
};

const allPetIndexes = (needs: ConciergeNeeds): number[] => needs.pets.map((_pet, index) => index);

/**
 * Which pets a care detail in this message is about, or 'ambiguous' when it cannot be told.
 * `fallback` says what an unspecific statement means: a "no" can safely cover everyone, a "yes"
 * must know which pet it is about, because it puts a paid line on that pet.
 */
const careTargets = (
  text: string,
  needs: ConciergeNeeds,
  fallback: 'all' | 'ambiguous',
): number[] | 'ambiguous' => {
  if (needs.pets.length < 2) {
    return allPetIndexes(needs);
  }
  const singles = SINGLES_ONE_OUT.test(text);
  const covers = COVERS_EVERY_PET.test(text);
  if (covers && singles) return 'ambiguous';
  if (covers) return allPetIndexes(needs);

  const named = petsNamedIn(text, needs);
  if (named.length > 0) return named;

  const speciesNamed = SPECIES_TARGETS.flatMap(({ species, pattern }) => {
    const match = text.match(pattern);
    return match ? [{ species, plural: Boolean(match[1] ?? match[2]) }] : [];
  });
  const [onlySpecies] = speciesNamed;
  if (speciesNamed.length === 1 && onlySpecies) {
    const matching = needs.pets.flatMap((pet, index) =>
      pet.species === onlySpecies.species ? [index] : [],
    );
    if (matching.length === 0) return 'ambiguous';
    if (onlySpecies.plural || matching.length === 1) return matching;
    return 'ambiguous';
  }
  if (speciesNamed.length > 1 || singles || ONE_PET_PRONOUN.test(text)) {
    return 'ambiguous';
  }
  return fallback === 'all' ? allPetIndexes(needs) : 'ambiguous';
};

type MedicationStatement = 'yes' | 'no' | null;

const medicationStatement = (text: string): MedicationStatement => {
  if (MEDICATION_NO.test(text)) return 'no';
  if (!MEDICATION_WORD.test(text)) return null;
  return MEDICATION_NEGATED.test(text) ? null : 'yes';
};

export const detectAmbiguousCare = (text: string, needs: ConciergeNeeds): AmbiguousCare[] => {
  const ambiguous: AmbiguousCare[] = [];
  if (
    medicationStatement(text) === 'yes' &&
    careTargets(text, needs, 'ambiguous') === 'ambiguous'
  ) {
    ambiguous.push('medication');
  }
  if (FIRST_TIME.test(text) && careTargets(text, needs, 'ambiguous') === 'ambiguous') {
    ambiguous.push('firstTime');
  }
  return ambiguous;
};

const extractCare = (text: string, needs: ConciergeNeeds): ConciergeNeedsPatch['pets'] => {
  const changes = new Map<number, { needsMedication?: boolean; firstTimeBoarding?: boolean }>();
  const statement = medicationStatement(text);
  if (statement !== null) {
    const targets = careTargets(text, needs, statement === 'no' ? 'all' : 'ambiguous');
    if (targets !== 'ambiguous') {
      for (const index of targets) {
        changes.set(index, { ...changes.get(index), needsMedication: statement === 'yes' });
      }
    }
  }
  if (FIRST_TIME.test(text)) {
    const targets = careTargets(text, needs, 'ambiguous');
    if (targets !== 'ambiguous') {
      for (const index of targets) {
        changes.set(index, { ...changes.get(index), firstTimeBoarding: true });
      }
    }
  }
  if (changes.size === 0) {
    return undefined;
  }
  return Array.from(changes, ([index, change]) => ({ index, ...change }));
};

/**
 * The guest's answer to "Which pet takes medication?" / "...is here for the first time?": "the
 * cat", "Luna", "pet 2", "both", "none of them". Returns the pets it names, [] for none, or null
 * when the answer does not name any.
 */
export const pickPetsFromAnswer = (text: string, needs: ConciergeNeeds): number[] | null => {
  if (/\b(?:none|neither|no one|nobody)\b|都不|没有/i.test(text)) return [];
  if (COVERS_EVERY_PET.test(text) || /\ball\b/i.test(text)) return allPetIndexes(needs);
  const named = petsNamedIn(text, needs);
  if (named.length > 0) return named;
  const numbered = [...text.matchAll(/\bpet\s*(\d)\b|宠物\s*(\d)/gi)]
    .map((match) => Number(match[1] ?? match[2]) - 1)
    .filter((index) => index >= 0 && index < needs.pets.length);
  if (numbered.length > 0) return Array.from(new Set(numbered));
  const species = SPECIES_WORDS.filter(({ pattern }) => pattern.test(text));
  const [onlySpecies] = species;
  if (species.length === 1 && onlySpecies) {
    const matching = needs.pets.flatMap((pet, index) =>
      pet.species === onlySpecies.species ? [index] : [],
    );
    const everyPet = matching.length === needs.pets.length;
    return matching.length > 0 && !(everyPet && matching.length > 1) ? matching : null;
  }
  return null;
};

/**
 * A size word applies to the dogs still without one - unless the message names two sizes ("one is
 * large, one is small") or singles out one dog of several, where a guess could be wrong.
 */
const extractSize = (text: string, needs: ConciergeNeeds): ConciergeNeedsPatch['pets'] => {
  const sizes = SIZE_WORDS.filter(({ pattern }) => pattern.test(text));
  const [only] = sizes;
  if (sizes.length !== 1 || !only) {
    return undefined;
  }
  const unsized = needs.pets
    .map((pet, index) => ({ pet, index }))
    .filter(({ pet }) => pet.species === 'dog' && pet.size === null);
  if (unsized.length > 1 && SINGLES_ONE_OUT.test(text) && !COVERS_EVERY_PET.test(text)) {
    return undefined;
  }
  return unsized.map(({ index }) => ({ index, size: only.size }));
};

/** Applies extraction in order: pets first, so size and care can target the pets just found. */
export const extractNeedsPatches = (
  text: string,
  needs: ConciergeNeeds,
  today: string,
  mergeInto: (current: ConciergeNeeds, patch: ConciergeNeedsPatch) => ConciergeNeeds,
): ConciergeNeedsPatch[] => {
  const patches: ConciergeNeedsPatch[] = [];
  let working = needs;
  const push = (patch: ConciergeNeedsPatch): void => {
    patches.push(patch);
    working = mergeInto(working, patch);
  };

  const found = extractDateRange(text, today);
  // Dates already chosen are only replaced by a message that is clearly about the stay, so a
  // stray number in a care note never moves the booking.
  const datesAlreadySet = working.startDate !== null && working.endDate !== null;
  const dates = found && (!datesAlreadySet || STAY_WORDING.test(text)) ? found : null;
  if (!working.service && (BOARDING_INTENT.test(text) || dates)) {
    push({ service: 'boarding' });
  }
  if (dates) push(dates);

  const pets = extractPets(text, working);
  if (pets.petCount !== undefined) push(pets);

  const size = extractSize(text, working);
  if (size && size.length > 0) push({ pets: size });

  const care = extractCare(text, working);
  if (care && care.length > 0) push({ pets: care });

  const extras = {
    ...(WALKS.test(text) ? { walks: true } : {}),
    ...(GROOMING.test(text) ? { grooming: true } : {}),
    ...(PLAYTIME.test(text) ? { playtime: true } : {}),
  };
  if (Object.keys(extras).length > 0) push({ extras });

  return patches;
};
