import type {
  NoticeReviewReason,
  NoticeStayDates,
  ParentBookingNotificationKind,
  ParentNoticeFacts,
} from '../contracts/booking.notification.contract.js';

// Reads a parent notice's sentence back into what it says. The notices are stored as English
// sentences (booking.notification.messages.ts) and the table has no column for anything else, so
// a page in another language works from these facts instead of the English. Every sentence the
// notices have ever written is matched, including the wording of older notices, so old rows read
// the same way. A sentence that matches nothing gives null, and the page says something general.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The `formatStayDates` shapes: "12 to 15 Oct 2026", "28 Sep to 2 Oct 2026", "30 Dec 2026 to …". */
const DATES = String.raw`\d{1,2}(?: [A-Z][a-z]{2})?(?: \d{4})? to \d{1,2} [A-Z][a-z]{2} \d{4}`;
const DATES_PARTS =
  /^(\d{1,2})(?: ([A-Z][a-z]{2}))?(?: (\d{4}))? to (\d{1,2}) ([A-Z][a-z]{2}) (\d{4})$/;

/** What `joinPetNames` writes when a stay has no named pet. */
const UNNAMED_PET = 'your pet';

const REASON_WORDS: Readonly<Record<string, NoticeReviewReason>> = {
  'takes medication': 'medication',
  'has behaviour or health needs to check': 'behaviour_or_health',
  'first stay with us': 'first_stay',
};
const LONG_STAY_WORDS = /^stays more than \d+ nights$/;

const isoDay = (year: number, month: number, day: number): string =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const monthNumber = (name: string): number => MONTHS.indexOf(name) + 1;

export const parseStayDates = (text: string | undefined): NoticeStayDates | null => {
  const parts = text ? DATES_PARTS.exec(text) : null;
  if (!parts) return null;
  const [, startDay, startMonthName, startYearText, endDay, endMonthName, endYearText] = parts;
  if (!startDay || !endDay || !endMonthName || !endYearText) return null;
  const endMonth = monthNumber(endMonthName);
  const endYear = Number(endYearText);
  const startMonth = startMonthName ? monthNumber(startMonthName) : endMonth;
  const startYear = startYearText ? Number(startYearText) : endYear;
  if (startMonth < 1 || endMonth < 1) return null;
  return {
    start: isoDay(startYear, startMonth, Number(startDay)),
    end: isoDay(endYear, endMonth, Number(endDay)),
  };
};

/** "Max", "Max and Bella", "Max, Bella and Coco"; "your pet" is no name at all. */
export const splitPetNames = (text: string): string[] => {
  if (text === UNNAMED_PET) return [];
  const last = text.lastIndexOf(' and ');
  if (last < 0) return [text];
  return [...text.slice(0, last).split(', '), text.slice(last + ' and '.length)];
};

const reasonOf = (words: string): NoticeReviewReason =>
  REASON_WORDS[words] ?? (LONG_STAY_WORDS.test(words) ? 'long_stay' : 'other');

/** "Max (takes medication) and Bella (first stay with us, takes medication)". */
const waitingPets = (text: string): { name: string; reasons: NoticeReviewReason[] }[] =>
  Array.from(text.matchAll(/(?:^|, | and )([^()]+?) \(([^()]*)\)/g)).flatMap(([, name, reasons]) =>
    name ? [{ name, reasons: (reasons ?? '').split(', ').map(reasonOf) }] : [],
  );

const CONFIRMED = new RegExp(`^Your booking (\\S+?) for (.+?)(?:, (${DATES}),)? is confirmed\\.`);
const APPROVED = new RegExp(`^(.+?)'s stay(?:, (${DATES}),)? is (?:confirmed|approved)\\.`);
const RECEIVED = new RegExp(
  `^We got your request (\\S+?)(?: for (.+?))?(?:, (${DATES}))?\\.(.*)$`,
  's',
);
const RECEIVED_CONFIRMED = / (.+?) (?:is|are) confirmed\./;
const RECEIVED_WAITING = /Our manager checks (.+?) before confirming\./;
const REFUSED = new RegExp(`^We can't take (.+?)(?: on (${DATES}))?\\.(?: Reason: ([\\s\\S]+))?$`);
const REOPENED = new RegExp(`^Our manager has reopened (.+?)'s request(?: for (${DATES}))?\\.`);
const MOVED = new RegExp(`^You moved (.+?)'s stay(?: to (${DATES}))?\\.`);

const approvedFacts = (body: string): ParentNoticeFacts | null => {
  const [, reference, confirmedPets, confirmedDates] = CONFIRMED.exec(body) ?? [];
  if (reference && confirmedPets) {
    return {
      template: 'confirmed',
      reference,
      pets: splitPetNames(confirmedPets),
      dates: parseStayDates(confirmedDates),
    };
  }
  const [, pets, dates] = APPROVED.exec(body) ?? [];
  return pets
    ? { template: 'approved', pets: splitPetNames(pets), dates: parseStayDates(dates) }
    : null;
};

const receivedFacts = (body: string): ParentNoticeFacts | null => {
  const [, reference, oldPetList, dates, rest = ''] = RECEIVED.exec(body) ?? [];
  if (!reference) return null;
  const confirmed = RECEIVED_CONFIRMED.exec(rest)?.[1];
  const waiting = RECEIVED_WAITING.exec(rest)?.[1];
  return {
    template: 'received',
    reference,
    dates: parseStayDates(dates),
    confirmed: confirmed ? splitPetNames(confirmed) : [],
    // The oldest notices named every pet and said nothing was booked until our manager approved.
    waiting: waiting
      ? waitingPets(waiting)
      : oldPetList
        ? splitPetNames(oldPetList).map((name) => ({ name, reasons: [] }))
        : [],
  };
};

const refusedFacts = (body: string): ParentNoticeFacts | null => {
  const [, pets, dates, reason] = REFUSED.exec(body) ?? [];
  return pets
    ? {
        template: 'refused',
        pets: splitPetNames(pets),
        dates: parseStayDates(dates),
        reason: reason?.trim() || null,
      }
    : null;
};

const backInReviewFacts = (body: string): ParentNoticeFacts | null => {
  const [, reopenedPets, reopenedDates] = REOPENED.exec(body) ?? [];
  if (reopenedPets) {
    return {
      template: 'reopened',
      pets: splitPetNames(reopenedPets),
      dates: parseStayDates(reopenedDates),
    };
  }
  const [, movedPets, movedDates] = MOVED.exec(body) ?? [];
  return movedPets
    ? { template: 'moved', pets: splitPetNames(movedPets), dates: parseStayDates(movedDates) }
    : null;
};

/**
 * The in-stay changes, the daily update and the stay report are not read back: their sentences
 * carry money and free prose that a page in another language does not restate. The reader shows
 * its general line for the kind and points to My stays or Live care, where the facts live.
 */
const noFacts = (): null => null;

const READERS: Record<ParentBookingNotificationKind, (body: string) => ParentNoticeFacts | null> = {
  booking_request_received: receivedFacts,
  booking_approved: approvedFacts,
  booking_refused: refusedFacts,
  booking_back_in_review: backInReviewFacts,
  booking_extended: noFacts,
  booking_picked_up_early: noFacts,
  booking_add_on_booked: noFacts,
  booking_times_changed: noFacts,
  booking_daily_update: noFacts,
  booking_stay_report: noFacts,
  booking_arrival_note: noFacts,
  booking_picked_up: noFacts,
  booking_late_pickup_charged: noFacts,
  booking_cancelled_by_parent: noFacts,
};

/** What a stored notice says, or null when its sentence is not one the notices write. */
export const noticeFactsOf = (
  kind: ParentBookingNotificationKind,
  body: string,
): ParentNoticeFacts | null => READERS[kind](body.trim());
