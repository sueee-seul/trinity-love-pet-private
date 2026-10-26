import { ApiError } from '../../api/apiError';
import type { PortalCopy, PortalLocale } from '../../i18n/portalLocale';
import type { PetStay } from '../../types/stays';

/**
 * When a guest can change a stay themselves, as My Stays shows it. The server decides and charges
 * (Backend booking.guest-change.ts and booking.guest-reschedule.ts); these only decide which
 * buttons to offer.
 */

/** New dates can be up to a year ahead. */
export const RESCHEDULE_WINDOW_DAYS = 365;

/** The longest stay the server prices (Backend CONCIERGE_MAX_STAY_NIGHTS); the picker stops there. */
export const MAX_STAY_NIGHTS = 60;

const AUCKLAND = 'Pacific/Auckland';
const aucklandDate = new Intl.DateTimeFormat('en-CA', { timeZone: AUCKLAND });
const aucklandClock = new Intl.DateTimeFormat('en-GB', {
  timeZone: AUCKLAND,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const DAY_LABELS: PortalCopy<Intl.DateTimeFormat> = {
  en: new Intl.DateTimeFormat('en-NZ', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }),
  zh: new Intl.DateTimeFormat('zh-CN', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }),
};

/** "2026-12-12": the Auckland calendar date of an instant. */
export const aucklandDateOf = (instant: Date | string): string =>
  aucklandDate.format(new Date(instant));

/** "10:30": the Auckland wall-clock time of an instant. */
export const aucklandClockOf = (instant: Date | string): string =>
  aucklandClock.format(new Date(instant));

/**
 * The first drop-off date the server accepts. A moved stay keeps its drop-off time of day, so
 * "today" only works while that time is still ahead; once it has passed, the earliest day is
 * tomorrow (the server refuses a drop-off in the past).
 */
export const earliestNewDropOff = (stay: Pick<PetStay, 'dropOffAt'>, now: Date): string => {
  const today = aucklandDateOf(now);
  return aucklandClockOf(now) >= aucklandClockOf(stay.dropOffAt) ? addDays(today, 1) : today;
};

/** The last pick-up date for a drop-off date: the server prices at most MAX_STAY_NIGHTS nights. */
export const latestPickUpFor = (startDate: string): string => addDays(startDate, MAX_STAY_NIGHTS);

/** "2026-12-12" plus `days`. */
export const addDays = (isoDate: string, days: number): string => {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

/** "Sat 12 Dec" (month-day then weekday in Chinese) for a "2026-12-12" date. */
export const formatDay = (isoDate: string, locale: PortalLocale = 'en'): string =>
  DAY_LABELS[locale].format(new Date(`${isoDate}T00:00:00Z`)).replace(',', '');

/** "Tue 15 Dec 16:00" (month-day, weekday and time in Chinese): the Auckland day and wall-clock time of an instant. */
export const formatDayAndClock = (instant: string, locale: PortalLocale = 'en'): string =>
  `${formatDay(aucklandDateOf(instant), locale)} ${aucklandClockOf(instant)}`;

export const formatMoney = (amount: number): string => `$${amount.toFixed(2)}`;

/** Paid at request and not settled yet: cancelling refunds, it does not release a hold. */
export const isPaid = (stay: PetStay): boolean =>
  stay.card?.status === 'succeeded' && stay.card.capturedAmount === null;

// How each language joins a list: "Biscuit, Mochi and Rex", or with the Chinese list comma
// and "and" in Chinese.
const LIST_JOINERS: PortalCopy<{ between: string; beforeLast: string }> = {
  en: { between: ', ', beforeLast: ' and ' },
  zh: { between: '、', beforeLast: ' 和 ' },
};

/** "Biscuit", "Biscuit and Mochi", "Biscuit, Mochi and Rex". */
export const listOfNames = (names: string[], locale: PortalLocale = 'en'): string => {
  if (names.length < 2) return names.join('');
  const { between, beforeLast } = LIST_JOINERS[locale];
  return `${names.slice(0, -1).join(between)}${beforeLast}${names.at(-1)}`;
};

/** The server's own words for a refusal (they are written for guests), or a plain fallback. */
export const problemMessage = (error: unknown, fallback: string): string =>
  error instanceof ApiError && error.message ? error.message : fallback;

const errorEnvelopeOf = (error: unknown): { code?: unknown; details?: unknown } | null => {
  if (!(error instanceof ApiError) || typeof error.body !== 'object' || error.body === null) {
    return null;
  }
  const envelope = (error.body as { error?: { code?: unknown; details?: unknown } }).error;
  return envelope ?? null;
};

/** The server's stable error code, e.g. "CANCELLATION_FEE_CHANGED"; null for anything else. */
export const apiErrorCode = (error: unknown): string | null => {
  const code = errorEnvelopeOf(error)?.code;
  return typeof code === 'string' ? code : null;
};

/**
 * The amount a "changed since you checked" refusal carries (`details[0].amount`), so the dialog
 * can show the new figure at once; null when the refusal is about something else.
 */
export const changedAmountOf = (error: unknown): number | null => {
  const details = errorEnvelopeOf(error)?.details;
  const first: unknown = Array.isArray(details) ? details[0] : null;
  if (typeof first !== 'object' || first === null || !('amount' in first)) return null;
  const amount = (first as { amount: unknown }).amount;
  return typeof amount === 'number' ? amount : null;
};

/** The nights a "fully booked" refusal names, e.g. ["2026-12-20"]; empty for anything else. */
export const fullNightsOf = (error: unknown): string[] => {
  const details = errorEnvelopeOf(error);
  if (details?.code !== 'CONCIERGE_FULLY_BOOKED' || !Array.isArray(details.details)) return [];
  return details.details.flatMap((detail: unknown) =>
    typeof detail === 'object' && detail !== null && 'night' in detail
      ? [String((detail as { night: unknown }).night)]
      : [],
  );
};

/** Still on its booking: a request waiting for review, or a stay our manager approved. */
export const isOnBooking = (stay: Pick<PetStay, 'status'>): boolean =>
  stay.status === 'waiting_for_review' || stay.status === 'approved';

/**
 * Before drop-off, the guest can withdraw the request or cancel the approved stay here. A request
 * made without a card (nothing is paid online) is always open; an older stay with a card is open
 * while its card is not settled. A stay paid at request ('succeeded', nothing settled) is open too:
 * cancelling it refunds what is not owed.
 */
export const canCancelOnline = (stay: PetStay, now: Date = new Date()): boolean => {
  const { card } = stay;
  const cardOpen =
    card === null ||
    (card.capturedAmount === null &&
      (card.status === 'pending' ||
        card.status === 'authorized' ||
        card.status === 'failed' ||
        card.status === 'succeeded'));
  return (
    isOnBooking(stay) &&
    cardOpen &&
    stay.checkInOutcome === null &&
    now.getTime() < new Date(stay.dropOffAt).getTime()
  );
};

/**
 * As cancelling, while the stay's terms still allow a change (the server counts them: current terms
 * set no limit, older ones allowed one) and the card was not refused.
 */
export const canMoveOnline = (stay: PetStay, now: Date = new Date()): boolean =>
  canCancelOnline(stay, now) && stay.card?.status !== 'failed' && stay.dateChangesLeft !== 0;

/**
 * A change covers every pet on the booking, and the server refuses it once any of them has an
 * arrival outcome at the desk. So the buttons go for every pet of that booking, not only the one
 * whose card shows the outcome.
 */
export const bookingHasArrivalOutcome = (stay: PetStay, allStays: readonly PetStay[]): boolean =>
  allStays.some((other) => other.bookingId === stay.bookingId && other.checkInOutcome !== null);

/** An extension can add at most this many days to the booked pick-up date. */
export const EXTENSION_WINDOW_DAYS = 60;

/** Checked in at the desk and not yet checked out: the stay the in-stay changes apply to. */
const isUnderWay = (stay: PetStay, now: Date): boolean =>
  stay.status === 'staying_now' &&
  stay.checkInOutcome === 'checked_in' &&
  now.getTime() < new Date(stay.pickUpAt).getTime();

/** More nights at the rates booked: charged to the saved card now, or added to the bill. */
export const canExtendOnline = (stay: PetStay, now: Date = new Date()): boolean =>
  isUnderWay(stay, now);

/** A walk, playtime or other priced service for a day of the stay. */
export const canAddOn = (stay: PetStay, now: Date = new Date()): boolean => isUnderWay(stay, now);

/**
 * The drop-off time before the stay starts, the pick-up time until the pet is collected. The dates
 * stay as booked, so the price does not move.
 */
export const canChangeTimes = (stay: PetStay, now: Date = new Date()): boolean =>
  (stay.status === 'approved' && now.getTime() < new Date(stay.dropOffAt).getTime()) ||
  (stay.status === 'staying_now' && now.getTime() < new Date(stay.pickUpAt).getTime());
