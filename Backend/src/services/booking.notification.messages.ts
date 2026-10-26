import type {
  ChargeSettlement,
  StayChangeRequestDetails,
} from '../contracts/booking.change.contract.js';
import type { ParentBookingNotificationKind } from '../contracts/booking.notification.contract.js';
import { formatNewZealandDay, newZealandCalendarDate } from '../common/utils/new-zealand-time.js';
import type { BookingNoticeSubject } from '../repositories/booking.notification.repository.js';
import { REVIEW_REASON_WORDS, type ManagerReviewReason } from './booking.review-rules.js';
import { STAY_STATUS_LABELS, refusalReasonFor } from './stay-status.js';

// The words of every booking notice. A notice is a record of what happened at the time, so its
// text is written once, when the event happens, and never rewritten: the stay pages show the live
// status, so a notice sent before a later decision can never mislead. Pure, so each sentence is
// unit-tested without a database.

/** Written out rather than taken from Intl 'en-NZ', which prints "Sept" in newer ICU builds. */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Used only if a pet row has no name, so a notice never reads "for ." */
const UNNAMED_PET = 'your pet';

/** The same words the stay pages use for a decision, so the bell and My stays agree. */
export const PARENT_NOTIFICATION_TITLES: Record<ParentBookingNotificationKind, string> = {
  booking_request_received: 'Request received',
  booking_approved: STAY_STATUS_LABELS.approved,
  booking_refused: STAY_STATUS_LABELS.refused,
  booking_back_in_review: 'Back in review',
  booking_change_requested: 'Change requested',
  booking_change_approved: 'Change approved',
  booking_change_refused: 'Change not approved',
  booking_extended: 'Stay extended',
  booking_add_on_booked: 'Add-on booked',
  booking_times_changed: 'Time changed',
  booking_daily_update: "Today's update",
  booking_stay_report: 'How the stay went',
  booking_arrival_note: 'Settled in',
  booking_cancelled_by_parent: STAY_STATUS_LABELS.cancelled,
  booking_picked_up_early: 'Early check-out',
  booking_picked_up: 'Checked out',
  booking_late_pickup_charged: 'Late check-out charged',
};

/**
 * Chinese titles for the notices whose body is written in the parent's language (the updates the
 * job sends). Other kinds keep their English title until their bodies are written in Chinese too.
 */
export const PARENT_NOTIFICATION_TITLES_ZH: Partial<Record<ParentBookingNotificationKind, string>> =
  {
    booking_daily_update: '今日动态',
    booking_stay_report: '住宿报告',
    booking_arrival_note: '已安顿',
  };

/** The title of a notice in the language its body was written in. */
export const noticeTitle = (kind: ParentBookingNotificationKind, locale: 'en' | 'zh'): string =>
  (locale === 'zh' ? PARENT_NOTIFICATION_TITLES_ZH[kind] : undefined) ??
  PARENT_NOTIFICATION_TITLES[kind];

/** Parent, after cancelling or withdrawing in My Stays; the fee line makes it the receipt. */
export const cancelledByParentBody = (
  subject: BookingNoticeSubject,
  reference: string,
  fee: number,
): string => {
  const dates = stayDatesOf(subject);
  const stay = dates ? `, ${dates},` : '';
  const money =
    fee > 0
      ? `${formatNoticeMoney(fee)} was kept under the cancellation rules you agreed to; the rest goes back to your card.`
      : 'Nothing was charged.';
  return `You cancelled ${joinPetNames(subject.petNames)}'s stay${stay} reference ${reference}. ${money}`;
};

/** "$86.00", the way every notice writes money. */
export const formatNoticeMoney = (amount: number): string => `$${amount.toFixed(2)}`;

/** "1 night" or "3 nights". */
const nightsWord = (nights: number): string => `${nights} ${nights === 1 ? 'night' : 'nights'}`;

/** "Sat 19 Dec 2026" for an ISO date, on Auckland days. */
const dayOf = (isoDate: string): string => {
  const [year, month, day] = isoDate.split('-').map(Number);
  return `${day} ${monthName(month ?? 0)} ${year}`;
};

/** "4:00 pm", the Auckland wall-clock time of an instant. */
const timeOf = (instant: Date): string =>
  new Intl.DateTimeFormat('en-NZ', {
    timeZone: 'Pacific/Auckland',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
    .format(instant)
    .toLowerCase();

/** Where the money of an in-stay change went: the saved card, or the bill paid at check-out. */
const settlementSentence = (amount: number, settlement: ChargeSettlement): string =>
  settlement === 'desk'
    ? `${formatNoticeMoney(amount)} was added to your bill. You pay it at the desk when you check out.`
    : `${formatNoticeMoney(amount)} was charged to your saved card.`;

/** Parent, after extending a stay under way; the amount is named so the notice is the receipt. */
export const stayExtendedBody = (
  subject: BookingNoticeSubject,
  newEndDate: string,
  addedNights: number,
  amount: number,
  settlement: ChargeSettlement,
): string =>
  `${joinPetNames(subject.petNames)}'s stay now ends on ${dayOf(newEndDate)}: ${nightsWord(addedNights)} more at the rates you booked. ` +
  settlementSentence(amount, settlement);

/** Parent, after booking an add-on for one day; the amount is named so the notice is the receipt. */
export const addOnBookedBody = (
  petName: string,
  serviceName: string,
  quantity: number,
  date: string,
  amount: number,
  settlement: ChargeSettlement,
): string =>
  `${quantity > 1 ? `${quantity} x ` : ''}${serviceName} booked for ${petName} on ${dayOf(date)}. ` +
  settlementSentence(amount, settlement);

/** Parent, after changing a check-in or check-out time of day. */
export const timesChangedBody = (petName: string, dropOffAt: Date, pickUpAt: Date): string =>
  `${petName}'s times are now: check-in ${timeOf(dropOffAt)}, check-out ${timeOf(pickUpAt)}, on ${formatStayDates(dropOffAt, pickUpAt)}.`;

/** Managers, for every change a parent made to a stay under way; the words say what to expect. */
export const managerInStayChangeBody = (
  subject: BookingNoticeSubject,
  reference: string,
  change: string,
): string => `${joinPetNames(subject.petNames)}: ${change} Reference ${reference}.`;

export const MANAGER_BOOKING_REQUEST_TITLE = 'New booking request';
/** The bell title of the reminder 4 hours before a request's review deadline. */
export const MANAGER_REVIEW_DUE_TITLE = 'Decision due soon';
/** The bell title when a parent extended, shortened, added to or re-timed a stay under way. */
export const MANAGER_STAY_CHANGED_TITLE = 'Stay changed by the parent';
/** The bell title when a parent asks to change a stay under way. */
export const MANAGER_CHANGE_REQUEST_TITLE = 'Change request';
/** The bell title when a dose passed its hour with no tick (Scenario 11: flag it at once). */
export const MANAGER_MEDICATION_OVERDUE_TITLE = 'Medication overdue';
/** The bell title when something needs a person (an escalation with a suggested step). */
export const MANAGER_ESCALATION_TITLE = 'Needs a person';
/** The bell title when a parent said they are on their way to collect. */
export const MANAGER_ON_THE_WAY_TITLE = 'Parent on the way';

/** Every manager booking notice title by its `notification_setting`; new requests otherwise. */
export const MANAGER_BOOKING_TITLES: Readonly<Record<string, string>> = {
  booking_review_due: MANAGER_REVIEW_DUE_TITLE,
  booking_changed_by_guest: MANAGER_STAY_CHANGED_TITLE,
  booking_change_requested: MANAGER_CHANGE_REQUEST_TITLE,
  booking_medication_overdue: MANAGER_MEDICATION_OVERDUE_TITLE,
  booking_escalation: MANAGER_ESCALATION_TITLE,
  booking_parent_on_the_way: MANAGER_ON_THE_WAY_TITLE,
};

const monthName = (month: number): string => MONTHS[month - 1] ?? '';

/**
 * "12 to 15 Oct 2026", "28 Sep to 2 Oct 2026" or "30 Dec 2026 to 2 Jan 2027", on Auckland days.
 * The same shape as the pet parent pages (Frontend/.../stays/formatStayDate.ts).
 */
export const formatStayDates = (dropOffTime: Date, pickUpTime: Date): string => {
  const start = newZealandCalendarDate(dropOffTime);
  const end = newZealandCalendarDate(pickUpTime);
  const endLabel = `${end.day} ${monthName(end.month)} ${end.year}`;
  if (start.year !== end.year) {
    return `${start.day} ${monthName(start.month)} ${start.year} to ${endLabel}`;
  }
  if (start.month !== end.month) {
    return `${start.day} ${monthName(start.month)} to ${endLabel}`;
  }
  return `${start.day} to ${endLabel}`;
};

const stayDatesOf = (subject: BookingNoticeSubject): string | null =>
  subject.dropOffTime && subject.pickUpTime
    ? formatStayDates(subject.dropOffTime, subject.pickUpTime)
    : null;

/** "Max", "Max and Bella", "Max, Bella and Coco". */
export const joinPetNames = (petNames: readonly string[]): string => {
  const names = petNames.map((name) => name.trim()).filter((name) => name.length > 0);
  const last = names.at(-1);
  if (!last) return UNNAMED_PET;
  if (names.length === 1) return last;
  return `${names.slice(0, -1).join(', ')} and ${last}`;
};

/** A pet as it left checkout. Every pet waits for a manager; `reasons` flag what to look at. */
export interface PlacedPet {
  name: string;
  reasons: ManagerReviewReason[];
}

/** "Bella (takes medication)", or just "Bella" when nothing stands out. */
const withReasons = (pet: PlacedPet): string =>
  pet.reasons.length === 0
    ? pet.name
    : `${pet.name} (${pet.reasons.map((reason) => REVIEW_REASON_WORDS[reason]).join(', ')})`;

/** Nothing is paid online: the parent pays at the desk once staff have seen the pet. */
const PAY_AT_DESK = 'You pay at the desk on arrival, after a quick health check.';

/**
 * Parent, on checkout. Nothing is booked yet: every pet waits for our manager, who approves or
 * declines it. Starts the way the oldest received notices did ("We got your request PB-… for
 * Max and Bella, …"), which booking.notification.facts.ts reads as every pet waiting.
 */
export const requestReceivedBody = (subject: BookingNoticeSubject, reference: string): string => {
  const dates = stayDatesOf(subject);
  const stay = dates ? `, ${dates}` : '';
  return (
    `We got your request ${reference} for ${joinPetNames(subject.petNames)}${stay}. ` +
    'Nothing is booked yet: our manager will check it and let you know here once it is approved or declined. ' +
    PAY_AT_DESK
  );
};

/** "Thu 15 Oct at 10:00 am": when to bring the pet, in Auckland time. */
const arrivalOf = (dropOffTime: Date): string =>
  `${formatNewZealandDay(dropOffTime)} at ${timeOf(dropOffTime)}`;

/**
 * Parent, when the manager approves a stay. Says when to come and what happens at the desk; the
 * boarding pass exists from this moment.
 */
export const approvedBody = (subject: BookingNoticeSubject): string => {
  const dates = stayDatesOf(subject);
  const stay = dates ? `, ${dates},` : '';
  const pets = joinPetNames(subject.petNames);
  const arrival = subject.dropOffTime
    ? ` Please bring ${pets} on ${arrivalOf(subject.dropOffTime)}.`
    : '';
  return (
    `${pets}'s stay${stay} is approved.${arrival} ` +
    'We do a quick health check at the desk, then you pay there. Your boarding pass is in My stays.'
  );
};

/** Parent, when the manager refuses one pet. The manager's reason is the parent's answer. */
export const refusedBody = (subject: BookingNoticeSubject, refusalReason: string): string => {
  const dates = stayDatesOf(subject);
  const stay = dates ? ` on ${dates}` : '';
  const reason = refusalReasonFor('refused', refusalReason);
  const sentence = `We can't take ${joinPetNames(subject.petNames)}${stay}.`;
  return reason ? `${sentence} Reason: ${reason}` : sentence;
};

/** Parent, when the manager undoes a decision and the request waits for review again. */
export const backInReviewBody = (subject: BookingNoticeSubject): string => {
  const dates = stayDatesOf(subject);
  const stay = dates ? ` for ${dates}` : '';
  const waiting = STAY_STATUS_LABELS.waiting_for_review.toLowerCase();
  return (
    `Our manager has reopened ${joinPetNames(subject.petNames)}'s request${stay}. ` +
    `It is ${waiting} again.`
  );
};

/** Parent, when they moved their own stay: the new dates wait for the manager, and nothing is held. */
export const datesChangedBody = (subject: BookingNoticeSubject): string => {
  const dates = stayDatesOf(subject);
  const stay = dates ? ` to ${dates}` : '';
  return (
    `You moved ${joinPetNames(subject.petNames)}'s stay${stay}. ` +
    'Our manager will review the new dates. Nothing is booked until they approve.'
  );
};

/** Managers, when a guest moved an approved or waiting stay: it needs a decision again. */
export const managerDatesChangedBody = (
  subject: BookingNoticeSubject,
  reference: string,
): string => {
  const dates = stayDatesOf(subject);
  const stay = dates ? ` to ${dates}` : '';
  return (
    `The guest moved ${joinPetNames(subject.petNames)}'s stay${stay}. ` +
    `Please review it again. Reference ${reference}.`
  );
};

/**
 * Managers, on checkout, for every new request. The reasons say what to look at, and the
 * reference and dates find it on Bookings.
 */
export const managerRequestBody = (
  subject: BookingNoticeSubject,
  reference: string,
  pets: readonly PlacedPet[],
): string => {
  const dates = stayDatesOf(subject);
  const stay = dates ? `, ${dates}` : '';
  return `Please review ${joinPetNames(pets.map(withReasons))}${stay}. Reference ${reference}.`;
};

// ----- Change requests while the pet is staying ---------------------------------------------------

/** "4:00 pm" for a wall-clock "16:00". */
const clockOf = (time: string): string => {
  const [hour = 0, minute = 0] = time.split(':').map(Number);
  const suffix = hour < 12 ? 'am' : 'pm';
  return `${hour % 12 === 0 ? 12 : hour % 12}:${String(minute).padStart(2, '0')} ${suffix}`;
};

/**
 * One line for a change request, for the parent, the managers and the chat:
 * "extend Max's stay to 17 Oct 2026 ($55.00)", "Extra Playtime for Max on 15 Oct 2026 ($12.00)",
 * "new times for Max: check-out 11:00 am".
 */
export const stayChangeSummary = (
  details: StayChangeRequestDetails,
  petNames: readonly string[],
  amount: number | null,
): string => {
  const pets = joinPetNames(petNames);
  const money = amount !== null && amount > 0 ? ` (${formatNoticeMoney(amount)})` : '';
  switch (details.kind) {
    case 'extend':
      return `extend ${pets}'s stay to ${dayOf(details.endDate)}${money}`;
    case 'add_on': {
      const times = details.quantity > 1 ? ` x${details.quantity}` : '';
      return `${details.serviceName}${times} for ${pets} on ${dayOf(details.date)}${money}`;
    }
    case 'times': {
      const parts = [
        details.dropOffTime ? `check-in ${clockOf(details.dropOffTime)}` : null,
        details.pickUpTime ? `check-out ${clockOf(details.pickUpTime)}` : null,
      ].filter((part): part is string => part !== null);
      return `new times for ${pets}: ${parts.join(', ')}`;
    }
    case 'early_check_out':
      return `pick ${pets} up early`;
  }
};

/** Parent, when the request is saved: nothing changes until our manager approves it. */
export const changeRequestedBody = (summary: string): string =>
  `We got your request to ${summary}. Our manager will check it and let you know here. ` +
  'Nothing changes until it is approved. Any amount is added to your bill, paid at the desk at pick-up.';

/** Parent (chat), when our manager approved the request and the change was made. */
export const changeApprovedBody = (summary: string): string =>
  `Our manager approved your request to ${summary}. It is done, and the team has it on their list. ` +
  'Any amount is added to your bill, paid at the desk at pick-up.';

/** Parent, when our manager refused the request. The manager's reason is the parent's answer. */
export const changeRefusedBody = (summary: string, reason: string): string =>
  `We can't ${summary}. Reason: ${reason.trim()}`;

/** Managers: a request to decide on Bookings. */
export const managerChangeRequestBody = (
  petNames: readonly string[],
  summary: string,
  reference: string,
): string => `${joinPetNames(petNames)}: the parent asks to ${summary}. Reference ${reference}.`;
