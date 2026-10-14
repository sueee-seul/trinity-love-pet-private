import * as repo from '../repositories/petparent.livecare.repository.js';
import { AppError } from '../common/middlewares/error.middleware.js';
import { translateCareNotes } from './care-note.translation.js';
import { hasLiveCare } from './stay-status.js';
import { isTaskVideo, taskMediaPath } from './task.media.js';

export type Category = 'potty' | 'meal' | 'solo' | 'play' | 'other';

/** The staff task's state as a parent reads it. Overdue is for staff only, so it stays upcoming. */
export type CareEntryStatus = 'completed' | 'in_progress' | 'upcoming';

export interface CareEntry {
  id: string;
  /** "9:00 AM", or null while the task has no time yet (staff see "Time not set"). */
  time: string | null;
  title: string;
  category: Category;
  icon: string;
  status: CareEntryStatus;
  detail?: string;
  /** `detail` machine-translated into Chinese, for a parent who reads Chinese. */
  detailInChinese?: string;
  photos?: string[];
}

/** The language the parent reads the page in. */
export type LiveCareLanguage = 'en' | 'zh';

export interface StatTile {
  label: string;
  value: string;
}

export interface LiveCareData {
  bookingPetId: string;
  petId: string;
  petName: string;
  petPhotoUrl?: string;
  /** The staff member rostered onto the pet, or null when nobody is yet. */
  sitterName: string | null;
  /** That staff member's facility, or null with no carer or no facility on file. */
  location: string | null;
  dropOffDate: string;
  pickUpDate: string;
  availableDates: string[];
  selectedDate: string;
  entries: CareEntry[];
  stats: StatTile[];
}

const ICONS: Record<Category, string> = {
  potty: '🐕',
  meal: '🍽️',
  play: '🐾',
  solo: '🧸',
  other: '📝',
};

// `tasks.category` isn't a reliable taxonomy here: booking-generated tasks
// leave it at the 'custom' default (see task.fromBooking.mapping.ts) and
// staff-picked templates mostly carry 'addon'. Classify off the title
// vocabulary those two places actually produce instead.
const classifyCategory = (title: string): Category => {
  const t = title.toLowerCase();
  if (/potty|pee|poop|bathroom|toilet/.test(t)) return 'potty';
  if (/feed|meal|breakfast|lunch|dinner|food/.test(t)) return 'meal';
  if (/play|walk|exercise|yard|enrichment/.test(t)) return 'play';
  if (/individual|solo|one-on-one|activity/.test(t)) return 'solo';
  return 'other';
};

// scheduled_at has its wall-clock digits written verbatim into the UTC
// fields (see task.read.repository.ts's rangePredicate comment), so read them
// back directly rather than re-running them through a timezone conversion.
// A booking-generated task sits at 00:00 until the manager sets its time, and the staff pages
// show that as "Time not set" (formatTaskTime in the admin task types); the parent's page says the
// same, so the two never disagree about when a task happens.
const formatTime = (value: Date): string | null => {
  if (value.getUTCHours() === 0 && value.getUTCMinutes() === 0) return null;
  const hour = value.getUTCHours();
  const minute = value.getUTCMinutes();
  const displayHour = hour % 12 || 12;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  return `${displayHour}:${String(minute).padStart(2, '0')} ${suffix}`;
};

const toEntryStatus = (status: string): CareEntryStatus => {
  if (status === 'completed') return 'completed';
  if (status === 'in_progress') return 'in_progress';
  return 'upcoming';
};

// Tasks with a time come in time order; the ones still waiting for a time go last.
const timedFirst = (entries: CareEntry[]): CareEntry[] => [
  ...entries.filter((entry) => entry.time !== null),
  ...entries.filter((entry) => entry.time === null),
];

const toCareEntry = (row: repo.DayTaskRow): CareEntry => {
  const category = classifyCategory(row.title);
  const entry: CareEntry = {
    id: row.id,
    time: formatTime(row.scheduled_at),
    title: row.title,
    category,
    icon: ICONS[category],
    status: toEntryStatus(row.status),
  };
  const detail = row.description?.trim();
  if (detail) entry.detail = detail;
  // The timeline's photo viewers show images only; a task's short video reaches the parent as the
  // day's update media (daily-summary.media.ts), so it is left out here.
  const photos = row.photos.filter((photo) => !isTaskVideo(photo.photo_url));
  if (photos.length > 0) {
    entry.photos = photos.map((photo) => taskMediaPath(row.id, photo.photo_url));
  }
  return entry;
};

const isMealOrMed = (entry: CareEntry): boolean =>
  entry.category === 'meal' || /medication/i.test(entry.title);
const isPlayOrSolo = (entry: CareEntry): boolean =>
  entry.category === 'play' || entry.category === 'solo';

// "done/planned" for one kind of care, or null when the day plans none of it: a "0/0" tile says
// nothing to a parent, so it is left out.
const ratioTile = (
  label: string,
  entries: CareEntry[],
  predicate: (entry: CareEntry) => boolean,
): StatTile | null => {
  const matching = entries.filter(predicate);
  if (matching.length === 0) return null;
  const completed = matching.filter((entry) => entry.status === 'completed').length;
  return { label, value: `${completed}/${matching.length}` };
};

// Real counts of what's actually scheduled today, not a fixed "expected
// total". potty_break_logs/feeding_logs/activity_logs (which the original
// mock's numbers implied) aren't populated.
const buildStats = (entries: CareEntry[]): StatTile[] => {
  const photosShared = entries.reduce((sum, entry) => sum + (entry.photos?.length ?? 0), 0);
  const tiles = [
    ratioTile('Potty Breaks', entries, (entry) => entry.category === 'potty'),
    ratioTile('Meals & Meds', entries, isMealOrMed),
    ratioTile('Play & Activities', entries, isPlayOrSolo),
  ].filter((tile): tile is StatTile => tile !== null);
  return [...tiles, { label: 'Photos Shared', value: String(photosShared) }];
};

// Every calendar date from dropOffDate to pickUpDate inclusive. Both are
// already-resolved 'YYYY-MM-DD' strings, so walking them as UTC midnight is
// safe; no further timezone conversion is needed here.
const buildAvailableDates = (dropOffDate: string, pickUpDate: string): string[] => {
  const dates: string[] = [];
  const cursor = new Date(`${dropOffDate}T00:00:00Z`);
  const end = new Date(`${pickUpDate}T00:00:00Z`);
  while (cursor.getTime() <= end.getTime()) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
};

const resolveSelectedDate = (
  requestedDate: string | undefined,
  availableDates: string[],
  todayAuckland: string,
): string => {
  if (requestedDate !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate) || !availableDates.includes(requestedDate)) {
      throw new AppError(
        "date must be one of this stay's available dates",
        'VALIDATION_FAILED',
        422,
      );
    }
    return requestedDate;
  }
  if (availableDates.includes(todayAuckland)) return todayAuckland;
  const first = availableDates[0];
  const last = availableDates[availableDates.length - 1];
  if (!first || !last) {
    throw new AppError('This stay has no scheduled dates', 'NO_STAY_FOUND', 404);
  }
  return todayAuckland < first ? first : last;
};

interface TimedCandidate extends repo.StayCandidateRow {
  dropOffTime: Date;
  pickUpTime: Date;
}

const hasBothTimes = (candidate: repo.StayCandidateRow): candidate is TimedCandidate =>
  candidate.dropOffTime !== null && candidate.pickUpTime !== null;

// Reduces a non-empty list to whichever candidate scores highest. This avoids
// sort()+[0] indexing, which TS can't see is safe even after a length check.
const pickBest = (
  list: TimedCandidate[],
  score: (candidate: TimedCandidate) => number,
): TimedCandidate =>
  list.reduce((best, candidate) => (score(candidate) > score(best) ? candidate : best));

// Picks, among the stays the manager approved: a stay in progress right now
// (most recently started, if several) -> the soonest upcoming one -> the most
// recently completed one. A pending or refused request never has live care.
export const resolveCurrentBookingPetId = async (petOwnersUuid: string): Promise<string> => {
  const candidates = (await repo.findStayCandidatesForOwner(petOwnersUuid)).filter((candidate) =>
    hasLiveCare(candidate.reviewStatus),
  );
  const [firstCandidate] = candidates;
  if (!firstCandidate) {
    throw new AppError('No stay found for this pet parent', 'NO_STAY_FOUND', 404);
  }

  const now = Date.now();
  const timed = candidates.filter(hasBothTimes);

  const inProgress = timed.filter(
    (c) => c.dropOffTime.getTime() <= now && now <= c.pickUpTime.getTime(),
  );
  if (inProgress.length > 0) {
    return pickBest(inProgress, (c) => c.dropOffTime.getTime()).bookingPetId;
  }

  const upcoming = timed.filter((c) => c.dropOffTime.getTime() > now);
  if (upcoming.length > 0) {
    return pickBest(upcoming, (c) => -c.dropOffTime.getTime()).bookingPetId;
  }

  const past = timed.filter((c) => c.pickUpTime.getTime() < now);
  if (past.length > 0) {
    return pickBest(past, (c) => c.pickUpTime.getTime()).bookingPetId;
  }

  return firstCandidate.bookingPetId;
};

const resolveOwnedStay = async (
  petOwnersUuid: string,
  bookingPetId: string,
): Promise<repo.StayRecord> => {
  const stay = await repo.findStayById(bookingPetId);
  // A stay the manager has not approved gets the same not-found answer as a missing one:
  // the pet was never booked in, so there is no care to show.
  if (!stay || stay.petOwnersUuid !== petOwnersUuid || !hasLiveCare(stay.reviewStatus)) {
    throw new AppError('Stay not found', 'NO_STAY_FOUND', 404);
  }
  return stay;
};

// Used to authorize the SSE stream endpoint before it opens. It only needs
// the pet id the event bus is keyed by, not the rest of the stay data.
export const getStayPetId = async (
  petOwnersUuid: string,
  bookingPetId: string,
): Promise<string> => {
  const stay = await resolveOwnedStay(petOwnersUuid, bookingPetId);
  return stay.petId;
};

/** Adds the Chinese of each staff note that could be translated; the rest stay as written. */
const withChineseNotes = async (entries: CareEntry[]): Promise<CareEntry[]> => {
  const noted = entries.filter((entry) => entry.detail);
  const chinese = await translateCareNotes(noted.map((entry) => entry.detail ?? ''));
  const byId = new Map(noted.map((entry, index) => [entry.id, chinese[index]]));
  return entries.map((entry) => {
    const detailInChinese = byId.get(entry.id);
    return detailInChinese ? { ...entry, detailInChinese } : entry;
  });
};

export const getLiveCare = async (
  petOwnersUuid: string,
  bookingPetId: string,
  requestedDate: string | undefined,
  language: LiveCareLanguage = 'en',
): Promise<LiveCareData> => {
  const stay = await resolveOwnedStay(petOwnersUuid, bookingPetId);
  if (!stay.dropOffDate || !stay.pickUpDate) {
    throw new AppError('This stay has no scheduled dates', 'NO_STAY_FOUND', 404);
  }

  const availableDates = buildAvailableDates(stay.dropOffDate, stay.pickUpDate);
  const todayAuckland = await repo.getTodayInAuckland();
  const selectedDate = resolveSelectedDate(requestedDate, availableDates, todayAuckland);

  const [taskRows, roster] = await Promise.all([
    repo.findDayTasks(stay.petId, stay.dropOffTime, stay.pickUpTime, selectedDate),
    repo.findRosterForDate(stay.petId, selectedDate),
  ]);

  const careEntries = timedFirst(taskRows.map(toCareEntry));
  const entries = language === 'zh' ? await withChineseNotes(careEntries) : careEntries;

  const data: LiveCareData = {
    bookingPetId: stay.bookingPetId,
    petId: stay.petId,
    petName: stay.petName,
    sitterName: roster.sitterName,
    location: roster.sitterName ? roster.facilityName : null,
    dropOffDate: stay.dropOffDate,
    pickUpDate: stay.pickUpDate,
    availableDates,
    selectedDate,
    entries,
    stats: buildStats(entries),
  };
  if (stay.petPhotoUrl) data.petPhotoUrl = stay.petPhotoUrl;
  return data;
};
