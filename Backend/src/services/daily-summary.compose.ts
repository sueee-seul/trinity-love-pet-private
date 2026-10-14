import type { DoseRecord } from '../contracts/medication.contract.js';
import type { StayDayCounts } from '../repositories/daily-summary.repository.js';
import type { DayTaskRow } from '../repositories/petparent.livecare.repository.js';
import { countDayMedia } from './daily-summary.media.js';
import type { TaskMediaKind } from './task.media.js';
import { SUMMARY_WORDS, type SummaryLocale } from './daily-summary.words.js';

/**
 * The words of a daily update, the arrival note and the stay report, written from counts and
 * records only, in the parent's language. Pure, so every sentence is tested without a database.
 * Scenario 11 asks for a warm, plain summary in the parent's language that staff never have to
 * write; these sentences say only what the records show, and a dose is named as given only when
 * its task was ticked (outcome 6).
 */

export interface DayFacts {
  petName: string;
  /** The day as the parent reads it: "Sun 13 Dec" or "12月13日（周日）". */
  dayLabel: string;
  feedsDone: number;
  feedsPlanned: number;
  walksDone: number;
  playDone: number;
  /** Other completed care titles, for the "also" sentence. */
  otherDone: string[];
  /** Still photos staff attached to the day's tasks. */
  photos: number;
  /** Short videos staff attached to the day's tasks. */
  videos: number;
  doses: DoseRecord[];
  /** The notes staff wrote on completed tasks, kept short. */
  notes: string[];
  /** Kilograms from today's completed weight check ("12.4 kg"), or null when none was recorded. */
  weightKg: number | null;
  /** Toilet breaks recorded today (potty, toilet, 如厕). */
  toiletDone: number;
}

export const dayLabelOf = (instant: Date, locale: SummaryLocale = 'en'): string =>
  SUMMARY_WORDS[locale].dayLabel(instant);

const isFeed = (title: string): boolean => /feed|meal|breakfast|dinner/i.test(title);
const isWalk = (title: string): boolean => /walk/i.test(title);
const isPlay = (title: string): boolean => /play/i.test(title);
const isDose = (title: string): boolean => /^give |medication/i.test(title);
const isWeighIn = (title: string): boolean => /weigh|体重|称重/i.test(title);
const isToilet = (title: string): boolean =>
  /toilet|potty|pee|poo|bathroom break|如厕|上厕所|排便/i.test(title);

/** "12.4 kg", "12.4kg", "体重12.4公斤": the first weight written on a weight check. */
export const weightIn = (text: string | null): number | null => {
  const match = /(\d{1,3}(?:\.\d{1,2})?)\s*(?:kg|kgs|kilos?|公斤|千克)/i.exec(text ?? '');
  const kg = match ? Number(match[1]) : NaN;
  return Number.isFinite(kg) && kg > 0 ? kg : null;
};

/** The counts a day's tasks give, from the live care rows. */
export const factsFromDay = (
  petName: string,
  dayLabel: string,
  tasks: DayTaskRow[],
  doses: DoseRecord[],
): DayFacts => {
  const done = tasks.filter((task) => task.status === 'completed');
  const media = countDayMedia(tasks);
  return {
    petName,
    dayLabel,
    feedsDone: done.filter((task) => isFeed(task.title)).length,
    feedsPlanned: tasks.filter((task) => isFeed(task.title)).length,
    walksDone: done.filter((task) => isWalk(task.title)).length,
    playDone: done.filter((task) => isPlay(task.title)).length,
    otherDone: done
      .filter(
        (task) =>
          !isFeed(task.title) &&
          !isWalk(task.title) &&
          !isPlay(task.title) &&
          !isDose(task.title) &&
          !isToilet(task.title) &&
          !isWeighIn(task.title),
      )
      .map((task) => task.title.replace(/\s*\(add-on\)$/i, '')),
    photos: media.photos,
    videos: media.videos,
    doses,
    notes: done
      .map((task) => task.description?.trim() ?? '')
      .filter((note) => note.length > 0 && note.length <= 160)
      .slice(0, 2),
    toiletDone: done.filter((task) => isToilet(task.title)).length,
    weightKg:
      done
        .filter((task) => isWeighIn(task.title))
        .map((task) => weightIn(task.description))
        .find((kg) => kg !== null) ?? null,
  };
};

const feedingSentence = (facts: DayFacts, locale: SummaryLocale): string | null => {
  const words = SUMMARY_WORDS[locale];
  if (facts.feedsPlanned === 0) return null;
  if (facts.feedsDone === facts.feedsPlanned) {
    return facts.feedsPlanned === 1
      ? words.mealOne(facts.petName)
      : words.mealsAll(facts.petName, facts.feedsPlanned);
  }
  return words.mealsSome(facts.petName, facts.feedsDone, facts.feedsPlanned);
};

const activitySentence = (facts: DayFacts, locale: SummaryLocale): string | null => {
  const words = SUMMARY_WORDS[locale];
  const parts: string[] = [];
  if (facts.walksDone > 0) parts.push(words.walks(facts.walksDone));
  if (facts.playDone > 0) parts.push(words.play(facts.playDone));
  if (facts.otherDone.length > 0) {
    const others = facts.otherDone.slice(0, 2).map(words.careTitle);
    parts.push(locale === 'en' ? others.join(' and ') : words.list(others));
  }
  if (parts.length === 0) return null;
  return words.activity(words.list(parts));
};

/** Doses are named one by one; only a ticked dose is "given". */
export const medicationSentence = (
  petName: string,
  doses: DoseRecord[],
  locale: SummaryLocale = 'en',
): string | null => {
  const words = SUMMARY_WORDS[locale];
  if (doses.length === 0) return null;
  const given = doses.filter((dose) => dose.status === 'given');
  const notGiven = doses.filter((dose) => dose.status === 'not_given');
  const open = doses.filter((dose) => dose.status === 'due' || dose.status === 'overdue');
  const sentences: string[] = [];
  if (given.length > 0) {
    const list = given
      .map((dose) =>
        words.doseItem(
          dose.medicineName,
          words.slot(dose.slot),
          words.time(new Date(dose.givenAt ?? dose.dueAt)),
        ),
      )
      .join(locale === 'en' ? ', ' : '、');
    sentences.push(words.dosesGiven(petName, list));
  }
  for (const dose of notGiven) {
    sentences.push(words.doseNotGiven(dose.medicineName, words.slot(dose.slot), dose.reason));
  }
  if (open.length > 0) {
    const overdue = open.filter((dose) => dose.status === 'overdue').length;
    sentences.push(words.dosesOpen(open.length, overdue));
  }
  return joinSentences(sentences, locale);
};

/** English sentences are separated by a space; Chinese ones end with their own full stop. */
const joinSentences = (lines: string[], locale: SummaryLocale): string =>
  lines.join(locale === 'en' ? ' ' : '');

/** The daily update: what the records show for the day, and nothing else. */
export const composeDailyUpdate = (facts: DayFacts, locale: SummaryLocale = 'en'): string => {
  const words = SUMMARY_WORDS[locale];
  const lines = [
    words.intro(facts.petName, facts.dayLabel),
    feedingSentence(facts, locale),
    activitySentence(facts, locale),
    medicationSentence(facts.petName, facts.doses, locale),
    facts.toiletDone > 0 ? words.toilet(facts.petName, facts.toiletDone) : null,
    facts.weightKg ? words.weight(facts.petName, facts.weightKg) : null,
    ...facts.notes.map(words.staffNote),
    facts.photos > 0 ? words.photos(facts.photos) : null,
    facts.videos > 0 ? words.video(facts.petName) : null,
  ].filter((line): line is string => line !== null);
  if (lines.length === 1) lines.push(words.nothingYet(facts.petName));
  return joinSentences(lines, locale);
};

/**
 * The short note on the drop-off day: arrived, settling in, the full update comes at the hour.
 * `featured` is the kind of media the note carries, so it names a photo or a short video.
 */
export const composeArrivalNote = (
  petName: string,
  featured: TaskMediaKind | null,
  digestHour: number,
  locale: SummaryLocale = 'en',
): string => SUMMARY_WORDS[locale].arrival(petName, featured, digestHour);

export interface StayReportFacts {
  petName: string;
  nights: number;
  firstDay: string;
  lastDay: string;
  days: StayDayCounts[];
  dosesGiven: number;
  dosesPlanned: number;
  dosesNotGiven: number;
}

/** The "how the stay went" report at pick-up, for the parent and their vet. */
export const composeStayReport = (facts: StayReportFacts, locale: SummaryLocale = 'en'): string => {
  const words = SUMMARY_WORDS[locale].report;
  const feedsDone = facts.days.reduce((sum, day) => sum + day.feedsDone, 0);
  const feedsPlanned = facts.days.reduce((sum, day) => sum + day.feedsPlanned, 0);
  const walks = facts.days.reduce((sum, day) => sum + day.walks, 0);
  const play = facts.days.reduce((sum, day) => sum + day.play, 0);
  const photos = facts.days.reduce((sum, day) => sum + day.photos, 0);
  const lines = [words.stay(facts.petName, facts.nights, facts.firstDay, facts.lastDay)];
  if (feedsPlanned > 0) {
    lines.push(
      feedsDone === feedsPlanned
        ? words.mealsAll(feedsPlanned)
        : words.mealsSome(feedsDone, feedsPlanned),
    );
  }
  if (walks + play > 0) lines.push(words.exercise(walks, play));
  if (facts.dosesPlanned > 0) {
    const missed = facts.dosesPlanned - facts.dosesGiven - facts.dosesNotGiven;
    lines.push(words.medication(facts.dosesGiven, facts.dosesPlanned, facts.dosesNotGiven, missed));
  }
  lines.push(photos > 0 ? words.photos(photos) : words.noPhotos);
  return joinSentences(lines, locale);
};
