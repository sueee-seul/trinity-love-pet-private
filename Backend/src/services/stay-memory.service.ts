import type { NotificationLocale } from '../contracts/notification.preferences.contract.js';
import type { StayingPetForSummary } from '../repositories/daily-summary.repository.js';
import {
  insertMemoryNote,
  listMemoryNotes,
  type StayMemoryFacts,
  type StoredMemoryNote,
} from '../repositories/stay-memory.repository.js';
import { aucklandNightsBetween } from './booking.in-stay.js';
import type { DayFacts } from './daily-summary.compose.js';
import { raiseEscalation } from './escalation.service.js';

/**
 * The stay's memory (Scenario 11 outcome 7): one short note per day, written from the day's records
 * right after the daily update, so "she was anxious yesterday, has that settled?" has something to
 * stand on across days. The stay report reads them for highlights. Nothing here comes from a
 * model: the words are built from counts, and a trend (stretch goal 2) is a plain comparison with
 * the day before.
 */

/** Two days of eating less than planned is the point where staff are asked to look (stretch goal 2). */
export const APPETITE_WATCH_DAYS = 2;
/** How many notes the stay report reads back by default: a week of stay. */
export const MEMORY_NOTES_DEFAULT_LIMIT = 7;

export interface MemoryInput {
  petName: string;
  dayLabel: string;
  totalNights: number;
  facts: StayMemoryFacts;
  /** Yesterday's facts, when the stay had a yesterday. */
  previous: StayMemoryFacts | null;
}

/** Days of fewer walks and play than before, after which staff are asked to look. */
export const ACTIVITY_WATCH_DAYS = 2;
/** A weight this far from the first one recorded this stay is worth a look (5%). */
export const WEIGHT_WATCH_SHARE = 0.05;

/** The sentences of a note in one language; the composer picks the facts, these pick the words. */
interface MemoryWords {
  day: (pet: string, n: number, nights: number, label: string) => string;
  ateAll: string;
  ateSome: (done: number, planned: number) => string;
  less: string;
  better: string;
  activity: (walks: number, play: number) => string;
  medication: (given: number, planned: number, notGiven: number) => string;
  note: (text: string) => string;
  photos: (n: number) => string;
  weight: (kg: number) => string;
  watch: (days: number) => string;
  activityWatch: (days: number) => string;
  weightWatch: (from: number, to: number, percent: number) => string;
}

const EN: MemoryWords = {
  day: (pet: string, n: number, nights: number, label: string) =>
    `Day ${n} of ${pet}'s ${nights === 1 ? 'one-night' : `${nights}-night`} stay (${label}).`,
  ateAll: 'Appetite: ate every planned meal.',
  ateSome: (done: number, planned: number) => `Appetite: ate ${done} of ${planned} planned meals.`,
  less: ' That is less than the day before.',
  better: ' Better than the day before.',
  activity: (walks: number, play: number) =>
    walks + play === 0
      ? 'Activity: none recorded.'
      : `Activity: ${walks} walk${walks === 1 ? '' : 's'}, ${play} play session${play === 1 ? '' : 's'}.`,
  medication: (given: number, planned: number, notGiven: number) =>
    `Medication: ${given} of ${planned} doses given${notGiven > 0 ? `, ${notGiven} not given` : ''}.`,
  note: (text: string) => `Staff noted: "${text}"`,
  photos: (n: number) => `${n} photo${n === 1 ? '' : 's'} taken.`,
  weight: (kg: number) => `Weight: ${kg} kg.`,
  watch: (days: number) => `Watch: appetite down for ${days} days; staff have been asked to look.`,
  activityWatch: (days: number) =>
    `Watch: less active for ${days} days (fewer walks and play sessions); staff have been asked to look.`,
  weightWatch: (from: number, to: number, percent: number) =>
    `Watch: weight ${to} kg, ${percent}% ${to < from ? 'down' : 'up'} from ${from} kg at the start of the stay; staff have been asked to look.`,
};

const ZH: MemoryWords = {
  day: (pet: string, n: number, nights: number, label: string) =>
    `${pet}这次住${nights}晚，今天是第${n}天（${label}）。`,
  ateAll: '食欲：计划的每一餐都吃了。',
  ateSome: (done: number, planned: number) => `食欲：计划${planned}餐吃了${done}餐。`,
  less: '比前一天少。',
  better: '比前一天好。',
  activity: (walks: number, play: number) =>
    walks + play === 0 ? '活动：没有记录。' : `活动：${walks}次散步，${play}次玩耍。`,
  medication: (given: number, planned: number, notGiven: number) =>
    `用药：计划${planned}剂给了${given}剂${notGiven > 0 ? `，${notGiven}剂没有给` : ''}。`,
  note: (text: string) => `工作人员备注：“${text}”`,
  photos: (n: number) => `拍了${n}张照片。`,
  weight: (kg: number) => `体重：${kg}公斤。`,
  watch: (days: number) => `注意：食欲已连续${days}天偏低，已请工作人员查看。`,
  activityWatch: (days: number) =>
    `注意：已连续${days}天活动减少（散步和玩耍次数变少），已请工作人员查看。`,
  weightWatch: (from: number, to: number, percent: number) =>
    `注意：体重${to}公斤，比入住时的${from}公斤${to < from ? '轻' : '重'}了${percent}%，已请工作人员查看。`,
};

/** What the parent reads in the day's update while a trend stands (stretch goal 2). */
const PARENT_TREND_WORDS = {
  en: {
    appetite: (pet: string, days: number) =>
      `${pet} has eaten less than planned for ${days} days, so our team is keeping a close eye and checking in on ${pet}.`,
    activity: (pet: string, days: number) =>
      `${pet} has been less active than usual for ${days} days (fewer walks and play sessions); our team is checking in on ${pet}.`,
    weight: (pet: string, from: number, to: number, percent: number) =>
      `${pet} weighed ${to} kg today, ${percent}% ${to < from ? 'less' : 'more'} than the ${from} kg at the start of the stay; our team is keeping an eye on it.`,
  },
  zh: {
    appetite: (pet: string, days: number) =>
      `${pet}已经连续${days}天吃得比计划少，工作人员正在密切留意。`,
    activity: (pet: string, days: number) =>
      `${pet}连续${days}天活动比平时少（散步和玩耍次数减少），工作人员正在留意。`,
    weight: (pet: string, from: number, to: number, percent: number) =>
      `${pet}今天体重${to}公斤，比入住时的${from}公斤${to < from ? '轻' : '重'}了${percent}%，工作人员正在留意。`,
  },
} as const;

const ateLess = (facts: StayMemoryFacts): boolean =>
  facts.feedsPlanned > 0 && facts.feedsDone < facts.feedsPlanned;

const activityOf = (facts: StayMemoryFacts): number => facts.walks + facts.play;

/** The weight change since the first weight of the stay, as a share; null without two weights. */
const weightChange = (facts: StayMemoryFacts): number | null =>
  facts.weightKg && facts.baselineWeightKg
    ? (facts.weightKg - facts.baselineWeightKg) / facts.baselineWeightKg
    : null;

const percentOf = (share: number): number => Math.round(Math.abs(share) * 1000) / 10;

/** The day's note, from the counts and up to two staff notes. Pure. */
export const composeMemoryNote = (
  input: MemoryInput,
  notes: string[],
  locale: NotificationLocale,
): string => {
  const words = locale === 'zh' ? ZH : EN;
  const { facts, previous } = input;
  const lines = [words.day(input.petName, facts.dayNumber, input.totalNights, input.dayLabel)];
  if (facts.feedsPlanned > 0) {
    let appetite = ateLess(facts)
      ? words.ateSome(facts.feedsDone, facts.feedsPlanned)
      : words.ateAll;
    if (previous && previous.feedsPlanned > 0) {
      if (ateLess(facts) && !ateLess(previous)) appetite += words.less;
      if (!ateLess(facts) && ateLess(previous)) appetite += words.better;
    }
    lines.push(appetite);
  }
  lines.push(words.activity(facts.walks, facts.play));
  if (facts.dosesPlanned > 0) {
    lines.push(words.medication(facts.dosesGiven, facts.dosesPlanned, facts.dosesNotGiven));
  }
  if (facts.weightKg) lines.push(words.weight(facts.weightKg));
  for (const note of notes.slice(0, 2)) lines.push(words.note(note));
  if (facts.photos > 0) lines.push(words.photos(facts.photos));
  if (facts.appetiteDownStreak >= APPETITE_WATCH_DAYS)
    lines.push(words.watch(facts.appetiteDownStreak));
  const activityStreak = facts.activityDownStreak ?? 0;
  if (activityStreak >= ACTIVITY_WATCH_DAYS) lines.push(words.activityWatch(activityStreak));
  const change = weightChange(facts);
  if (change !== null && Math.abs(change) >= WEIGHT_WATCH_SHARE && facts.baselineWeightKg) {
    lines.push(words.weightWatch(facts.baselineWeightKg, facts.weightKg ?? 0, percentOf(change)));
  }
  return lines.join(locale === 'zh' ? '' : ' ');
};

const dayNoon = (day: string): Date => new Date(`${day}T12:00:00+13:00`);

export type StayTrend = 'appetite' | 'activity' | 'weight';

export interface MemoryPlan {
  facts: StayMemoryFacts;
  body: string;
  /** Trends that reached their mark today: staff get one escalation for each. */
  newTrends: StayTrend[];
  /** Sentences for the parent's update while a trend stands, in the parent's language. */
  parentLines: string[];
}

type PetForMemory = Pick<StayingPetForSummary, 'petName' | 'dropOffAt' | 'pickUpAt' | 'locale'>;

/**
 * Today's note and the trends behind it (stretch goal 2), from the day's facts and yesterday's
 * note. Pure. Appetite counts days below plan; activity counts days with fewer walks and play than
 * the day before (and days that stay that low); weight compares with the first weight of the stay.
 * Each trend is flagged to staff once, the day it reaches its mark, and told to the parent in the
 * update for as long as it stands.
 */
export const planMemoryNote = (
  pet: PetForMemory,
  day: string,
  dayFacts: DayFacts,
  previous: StayMemoryFacts | null,
): MemoryPlan => {
  const facts: StayMemoryFacts = {
    dayNumber: aucklandNightsBetween(pet.dropOffAt, dayNoon(day)) + 1,
    feedsDone: dayFacts.feedsDone,
    feedsPlanned: dayFacts.feedsPlanned,
    walks: dayFacts.walksDone,
    play: dayFacts.playDone,
    dosesGiven: dayFacts.doses.filter((dose) => dose.status === 'given').length,
    dosesPlanned: dayFacts.doses.length,
    dosesNotGiven: dayFacts.doses.filter((dose) => dose.status === 'not_given').length,
    photos: dayFacts.photos,
    appetiteDownStreak: 0,
    activityDownStreak: 0,
    weightKg: dayFacts.weightKg,
    baselineWeightKg: previous?.baselineWeightKg ?? previous?.weightKg ?? dayFacts.weightKg,
    weightFlagged: previous?.weightFlagged ?? false,
  };
  facts.appetiteDownStreak = ateLess(facts) ? (previous?.appetiteDownStreak ?? 0) + 1 : 0;
  if (previous) {
    const before = activityOf(previous);
    const stillLow = (previous.activityDownStreak ?? 0) > 0 && activityOf(facts) <= before;
    const dropped = before > 0 && activityOf(facts) < before;
    facts.activityDownStreak = dropped || stillLow ? (previous.activityDownStreak ?? 0) + 1 : 0;
  }
  const change = weightChange(facts);
  const weightOff = change !== null && Math.abs(change) >= WEIGHT_WATCH_SHARE;

  const newTrends: StayTrend[] = [];
  if (facts.appetiteDownStreak === APPETITE_WATCH_DAYS) newTrends.push('appetite');
  if (facts.activityDownStreak === ACTIVITY_WATCH_DAYS) newTrends.push('activity');
  if (weightOff && !facts.weightFlagged) {
    newTrends.push('weight');
    facts.weightFlagged = true;
  }

  const parent = PARENT_TREND_WORDS[pet.locale === 'zh' ? 'zh' : 'en'];
  const parentLines: string[] = [];
  if (facts.appetiteDownStreak >= APPETITE_WATCH_DAYS) {
    parentLines.push(parent.appetite(pet.petName, facts.appetiteDownStreak));
  }
  if ((facts.activityDownStreak ?? 0) >= ACTIVITY_WATCH_DAYS) {
    parentLines.push(parent.activity(pet.petName, facts.activityDownStreak ?? 0));
  }
  if (weightOff && change !== null && facts.baselineWeightKg && facts.weightKg) {
    parentLines.push(
      parent.weight(pet.petName, facts.baselineWeightKg, facts.weightKg, percentOf(change)),
    );
  }

  const body = composeMemoryNote(
    {
      petName: pet.petName,
      dayLabel: dayFacts.dayLabel,
      totalNights: aucklandNightsBetween(pet.dropOffAt, pet.pickUpAt),
      facts,
      previous,
    },
    dayFacts.notes,
    pet.locale,
  );
  return { facts, body, newTrends, parentLines };
};

/** Yesterday's facts for a stay, the base every trend is measured from. */
export const previousMemoryFacts = async (bookingPetId: string): Promise<StayMemoryFacts | null> =>
  (await listMemoryNotes(bookingPetId, 1))[0]?.facts ?? null;

const TREND_ESCALATION: Record<
  StayTrend,
  (pet: string, facts: StayMemoryFacts) => { summary: string; suggestedStep: string }
> = {
  appetite: (pet, facts) => ({
    summary: `${pet} has eaten less than planned for ${APPETITE_WATCH_DAYS} days running (${facts.feedsDone} of ${facts.feedsPlanned} meals today).`,
    suggestedStep:
      'Check the pet for signs of illness or stress, try the usual food and routine, and tell the parent what you see.',
  }),
  activity: (pet, facts) => ({
    summary: `${pet} has been less active for ${ACTIVITY_WATCH_DAYS} days running (${facts.walks} walks and ${facts.play} play sessions today).`,
    suggestedStep:
      'Watch how the pet moves and settles, check for pain or stress, and tell the parent what you see.',
  }),
  weight: (pet, facts) => ({
    summary: `${pet} weighed ${facts.weightKg ?? '?'} kg today against ${facts.baselineWeightKg ?? '?'} kg at the start of the stay.`,
    suggestedStep:
      'Weigh again to confirm, check eating and stool, and call the vet if the change is real; tell the parent.',
  }),
};

/**
 * Writes today's note for a staying pet. Each trend that reaches its mark today becomes one
 * normal escalation, so a quiet change is seen before it becomes a vet visit.
 */
export const writeStayMemoryNote = async (
  pet: StayingPetForSummary,
  day: string,
  dayFacts: DayFacts,
  now: Date = new Date(),
  planned?: MemoryPlan,
): Promise<StoredMemoryNote | null> => {
  const plan =
    planned ?? planMemoryNote(pet, day, dayFacts, await previousMemoryFacts(pet.bookingPetsUuid));
  const stored = await insertMemoryNote({
    bookingPetsUuid: pet.bookingPetsUuid,
    date: day,
    locale: pet.locale,
    body: plan.body,
    facts: plan.facts,
  });
  if (!stored) return stored;
  for (const trend of plan.newTrends) {
    await raiseEscalation(
      {
        bookingId: pet.bookingId,
        bookingPetId: pet.bookingPetsUuid,
        source: 'behaviour_trend',
        severity: 'normal',
        ...TREND_ESCALATION[trend](pet.petName, plan.facts),
      },
      now,
    );
  }
  return stored;
};

/** The newest notes of a stay, for the stay report's highlights. */
export const stayMemoryFor = (
  bookingPetId: string,
  limit: number = MEMORY_NOTES_DEFAULT_LIMIT,
): Promise<StoredMemoryNote[]> => listMemoryNotes(bookingPetId, limit);
