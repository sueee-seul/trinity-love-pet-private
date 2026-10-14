import { listStayPhotos } from '../repositories/stay-photos.repository.js';
import { AppError } from '../common/middlewares/error.middleware.js';
import { newZealandDateOf, newZealandHourOf } from '../common/utils/new-zealand-time.js';
import { pool } from '../config/database.js';
import type { ParentBookingNotificationKind } from '../contracts/booking.notification.contract.js';
import {
  countCareByDay,
  hasSummary,
  insertSummary,
  listStayingPets,
  listSummariesForStay,
  type StayingPetForSummary,
  type StoredSummary,
  type SummaryKind,
} from '../repositories/daily-summary.repository.js';
import { listAdministrationsForDay } from '../repositories/medication.administration.repository.js';
import {
  findBookingRequestSubject,
  recordParentNotice,
  type ParentNoticeDraft,
} from '../repositories/booking.notification.repository.js';
import { findDayTasks, findStayById } from '../repositories/petparent.livecare.repository.js';
import {
  composeArrivalNote,
  composeDailyUpdate,
  composeStayReport,
  dayLabelOf,
  factsFromDay,
  type DayFacts,
} from './daily-summary.compose.js';
import { featuredDayMedia } from './daily-summary.media.js';
import { taskMediaPath } from './task.media.js';
import { aucklandNightsBetween } from './booking.in-stay.js';
import { sendBookingNoticeEmail } from './booking.transaction-emails.js';
import { recordMetric } from './care-metrics.service.js';
import { toDoseRecord } from './medication.record.service.js';
import { isQuietHour } from './notification-preferences.service.js';
import { warmDailyUpdate } from './daily-summary.writer.js';
import {
  planMemoryNote,
  previousMemoryFacts,
  writeStayMemoryNote,
  type MemoryPlan,
} from './stay-memory.service.js';

/**
 * What a parent gets without asking (Scenario 11 outcome 3), in their own language and at the hour
 * they chose: a short "settled in" note on the drop-off day, one update each day from the tasks,
 * photos and dose record, and the "how the stay went" report at pick-up (stretch goal). The booking
 * job calls `runDailySummaryPass` every 15 minutes; each piece is stored once, put in the bell and
 * emailed with a link to Live care, unless the parent turned update emails off.
 */

/** The default update hour (owner decision O14), used until a parent picks their own. */
export const DAILY_UPDATE_HOUR = 17;
/** The arrival note waits this long after the desk recorded the pet, so it has a photo to carry. */
const ARRIVAL_NOTE_DELAY_MS = 90 * 60_000;

const NOTICE_KIND: Record<SummaryKind, ParentBookingNotificationKind> = {
  daily: 'booking_daily_update',
  stay_report: 'booking_stay_report',
  arrival: 'booking_arrival_note',
};

const METRIC_KIND = {
  daily: 'daily_update_sent',
  stay_report: 'stay_report_sent',
  arrival: 'arrival_note_sent',
} as const;

const dayNoon = (day: string): Date => new Date(`${day}T12:00:00+13:00`);

interface DailyUpdatePiece {
  body: string;
  /** The day's featured photo or short video; the column keeps its first name. */
  photoPath: string | null;
  facts: Record<string, unknown>;
  /** The full facts, for the memory note written right after the update. */
  dayFacts: DayFacts;
}

const buildDailyUpdate = async (
  pet: StayingPetForSummary,
  day: string,
  now: Date,
): Promise<DailyUpdatePiece> => {
  const [tasks, doses] = await Promise.all([
    findDayTasks(pet.petUuid, pet.dropOffAt, pet.pickUpAt, day),
    listAdministrationsForDay(pet.bookingPetsUuid, day),
  ]);
  const facts = factsFromDay(
    pet.petName,
    dayLabelOf(dayNoon(day), pet.locale),
    tasks,
    doses.map((row) => toDoseRecord(row, now)),
  );
  // The record is what is true; the model may only reword it, and the record goes out otherwise.
  const warm = await warmDailyUpdate(facts, pet.locale, composeDailyUpdate(facts, pet.locale));
  return {
    body: warm.body,
    photoPath: featuredDayMedia(tasks)?.path ?? null,
    facts: {
      writtenBy: warm.writtenBy,
      feedsDone: facts.feedsDone,
      feedsPlanned: facts.feedsPlanned,
      walks: facts.walksDone,
      play: facts.playDone,
      photos: facts.photos,
      videos: facts.videos,
      dosesGiven: facts.doses.filter((dose) => dose.status === 'given').length,
      dosesPlanned: facts.doses.length,
    },
    dayFacts: facts,
  };
};

const buildStayReport = async (
  pet: StayingPetForSummary,
  now: Date,
): Promise<{ body: string; photoPath: string | null; facts: Record<string, unknown> }> => {
  const [days, photos] = await Promise.all([
    countCareByDay(pet.petUuid, pet.dropOffAt, pet.pickUpAt),
    listStayPhotos(pet.petUuid, pet.dropOffAt, pet.pickUpAt),
  ]);
  // The report opens on the stay's newest care photo (Scenario 11 stretch goal 3: "with photos").
  const [newest] = photos;
  let dosesGiven = 0;
  let dosesPlanned = 0;
  let dosesNotGiven = 0;
  for (const day of days) {
    const rows = await listAdministrationsForDay(pet.bookingPetsUuid, day.day);
    for (const row of rows) {
      const record = toDoseRecord(row, now);
      dosesPlanned += 1;
      if (record.status === 'given') dosesGiven += 1;
      if (record.status === 'not_given') dosesNotGiven += 1;
    }
  }
  const facts = {
    petName: pet.petName,
    nights: aucklandNightsBetween(pet.dropOffAt, pet.pickUpAt),
    firstDay: dayLabelOf(pet.dropOffAt, pet.locale),
    lastDay: dayLabelOf(pet.pickUpAt, pet.locale),
    days,
    dosesGiven,
    dosesPlanned,
    dosesNotGiven,
  };
  return {
    body: composeStayReport(facts, pet.locale),
    photoPath: newest ? taskMediaPath(newest.taskId, newest.storedName) : null,
    facts: {
      nights: facts.nights,
      days: days.length,
      dosesGiven,
      dosesPlanned,
      dosesNotGiven,
      photos: photos.length,
    },
  };
};

const buildArrivalNote = async (
  pet: StayingPetForSummary,
  day: string,
): Promise<{ body: string; photoPath: string | null; facts: Record<string, unknown> }> => {
  const tasks = await findDayTasks(pet.petUuid, pet.dropOffAt, pet.pickUpAt, day);
  const featured = featuredDayMedia(tasks);
  return {
    body: composeArrivalNote(pet.petName, featured?.kind ?? null, pet.digestHour, pet.locale),
    photoPath: featured?.path ?? null,
    facts: { photos: tasks.reduce((sum, task) => sum + task.photos.length, 0) },
  };
};

const liveCareLine = (pet: StayingPetForSummary): string =>
  pet.locale === 'zh'
    ? `照片和当天的完整记录在“照顾动态”：/parent/live-care/${pet.bookingPetsUuid}`
    : `See the photos and the full day on Live care: /parent/live-care/${pet.bookingPetsUuid}`;

const tellParent = async (
  pet: StayingPetForSummary,
  kind: SummaryKind,
  body: string,
): Promise<void> => {
  try {
    const subject = await findBookingRequestSubject(pet.bookingId);
    if (!subject) return;
    const draft: ParentNoticeDraft = {
      ownerId: subject.ownerId,
      bookingId: pet.bookingId,
      kind: NOTICE_KIND[kind],
      body,
      locale: pet.locale,
    };
    await recordParentNotice(draft);
    if (pet.emailUpdates) {
      void sendBookingNoticeEmail({ ...draft, body: `${body}\n\n${liveCareLine(pet)}` });
    }
  } catch (error: unknown) {
    console.error('[daily summary] notice was not written', {
      bookingPetsUuid: pet.bookingPetsUuid,
      kind,
      error: error instanceof Error ? error.name : 'unknown',
    });
  }
};

export interface DailySummaryPassResult {
  updates: number;
  reports: number;
  arrivals: number;
}

/**
 * The arrival note is due on the drop-off day, 90 minutes after the desk recorded the pet, outside
 * the parent's quiet hours, and only before their update hour (after it the day's update says it).
 */
const arrivalNoteDue = (pet: StayingPetForSummary, now: Date, today: string): boolean =>
  pet.checkInRecordedAt !== null &&
  newZealandDateOf(pet.dropOffAt) === today &&
  now.getTime() - pet.checkInRecordedAt.getTime() >= ARRIVAL_NOTE_DELAY_MS &&
  !isQuietHour(pet, now);

const writeAndTell = async (
  pet: StayingPetForSummary,
  today: string,
  kind: SummaryKind,
  piece: { body: string; photoPath: string | null; facts: Record<string, unknown> },
): Promise<boolean> => {
  const stored = await insertSummary({
    bookingPetsUuid: pet.bookingPetsUuid,
    date: today,
    kind,
    locale: pet.locale,
    ...piece,
  });
  if (!stored) return false;
  await tellParent(pet, kind, stored.body);
  void recordMetric(METRIC_KIND[kind], { bookingId: pet.bookingId });
  return true;
};

/**
 * One pass: each staying pet gets its day's update from its owner's chosen hour, the stay report on
 * the pick-up day, and before that hour an arrival note on the drop-off day. Each is written once,
 * so a job that runs every 15 minutes sends each at most once a day.
 */
export const runDailySummaryPass = async (
  now: Date = new Date(),
): Promise<DailySummaryPassResult> => {
  const result: DailySummaryPassResult = { updates: 0, reports: 0, arrivals: 0 };
  const today = newZealandDateOf(now);
  const hour = newZealandHourOf(now);
  for (const pet of await listStayingPets(now)) {
    if (hour < pet.digestHour) {
      if (
        arrivalNoteDue(pet, now, today) &&
        !(await hasSummary(pet.bookingPetsUuid, today, 'arrival'))
      ) {
        if (await writeAndTell(pet, today, 'arrival', await buildArrivalNote(pet, today))) {
          result.arrivals += 1;
        }
      }
      continue;
    }
    if (!(await hasSummary(pet.bookingPetsUuid, today, 'daily'))) {
      const { dayFacts, ...piece } = await buildDailyUpdate(pet, today, now);
      // A trend (appetite, activity, weight) is told to the parent in the same update, so the
      // parent and the facility hear about it on the same day (stretch goal 2).
      const plan: MemoryPlan | null = await previousMemoryFacts(pet.bookingPetsUuid)
        .then((previous) => planMemoryNote(pet, today, dayFacts, previous))
        .catch(() => null);
      const separator = pet.locale === 'zh' ? '' : ' ';
      const update =
        plan && plan.parentLines.length > 0
          ? { ...piece, body: [piece.body, ...plan.parentLines].join(separator) }
          : piece;
      if (await writeAndTell(pet, today, 'daily', update)) {
        result.updates += 1;
        // The memory note is the day's record for tomorrow's chat; a failure costs only the note.
        await writeStayMemoryNote(pet, today, dayFacts, now, plan ?? undefined).catch(
          (error: unknown) => {
            console.error('[daily summary] memory note was not written', {
              bookingPetsUuid: pet.bookingPetsUuid,
              error: error instanceof Error ? error.name : 'unknown',
            });
          },
        );
      }
    }
    const lastDay = newZealandDateOf(pet.pickUpAt);
    if (lastDay === today && !(await hasSummary(pet.bookingPetsUuid, today, 'stay_report'))) {
      const report = await buildStayReport(pet, now);
      if (await writeAndTell(pet, today, 'stay_report', report)) {
        result.reports += 1;
      }
    }
  }
  return result;
};

/** The signed-in owner's own stay, newest first; 404 exactly like a stay that does not exist. */
export const summariesForOwner = async (
  ownerId: string,
  bookingPetId: string,
): Promise<StoredSummary[]> => {
  const stay = await findStayById(bookingPetId);
  if (!stay || stay.petOwnersUuid !== ownerId) {
    throw new AppError('Stay not found', 'NOT_FOUND', 404);
  }
  return listSummariesForStay(bookingPetId, pool);
};
