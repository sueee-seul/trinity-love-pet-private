import { formatNewZealandDay, formatNewZealandTime } from '../common/utils/new-zealand-time.js';
import type { OutboundEmail } from './concierge/concierge.email.js';
import type { FeeSchedule } from './booking.fee-policy.js';

/**
 * The emails the 48-hour job sends: plain text, in the words the booking page uses, with no
 * marketing. Both name the two things a pet cannot stay without (the vaccination certificate and
 * the emergency vet consent), and both say plainly when the booking is only a test.
 */

export interface TeamContact {
  email: string | null;
  phone: string | null;
}

export interface BookingEmailDetails {
  to: string;
  firstName: string | null;
  reference: string;
  dropOffAt: Date;
  pickUpAt: Date;
  petNames: string[];
  amount: number;
  testMode: boolean;
  contact: TeamContact;
}

const money = new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' });
const formatNzd = (amount: number): string => money.format(amount);

const at = (instant: Date): string =>
  `${formatNewZealandDay(instant)}, ${formatNewZealandTime(instant)}`;

const listOf = (names: string[]): string =>
  names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;

const greeting = (firstName: string | null): string =>
  firstName?.trim() ? `Hi ${firstName.trim()},` : 'Hello,';

const stayLines = (details: BookingEmailDetails): string[] => [
  `Reference: ${details.reference}`,
  `Check-in: ${at(details.dropOffAt)}`,
  `Check-out: ${at(details.pickUpAt)}`,
  `Pets: ${listOf(details.petNames)}`,
];

const DROP_OFF_ITEMS = [
  'Please bring these to the desk at check-in:',
  "1. Your pet's current vaccination certificate (C5 for dogs, F3 for cats).",
  'Emergency vet consent up to NZ$500 is included in the current online booking terms. For an older booking, our team checks the consent on file.',
];

/** "email a@b.nz or call 09 555 0100", or a reply when no contact is configured. */
const reachUs = (contact: TeamContact): string => {
  const ways = [
    contact.email ? `email ${contact.email}` : null,
    contact.phone ? `call ${contact.phone}` : null,
  ].filter((way): way is string => way !== null);
  return ways.length > 0 ? ways.join(' or ') : 'reply to this email';
};

/**
 * Once the first-night fee applies it stays the same until drop-off, so stating it cannot go
 * stale. A free cancellation this close to drop-off lasts only until the two hours after approval
 * end, so it is left to My Stays rather than promised in an email that is read later.
 */
const cancellationLine = (fee: number | null): string =>
  fee !== null && fee > 0 ? `Cancelling now costs ${formatNzd(fee)}. ` : '';

/**
 * 48 hours before drop-off, once the card is held (or was held at booking). From the 2026-10-06
 * terms a pet without proof still stays, kept apart as the Code of Welfare allows, at no cost.
 */
const NO_SHOW_LINES: Record<FeeSchedule, string> = {
  tiered: `If you can't bring the vaccination certificate, your pet still stays with us, kept apart from other pets, at no extra cost. Not coming costs half of each confirmed pet's stay.`,
  tiered_with_grace: `If you can't provide the vaccination certificate that day, it counts as not coming, which costs half of each confirmed pet's stay.`,
  first_night: `If you can't provide the vaccination certificate that day, it counts as not coming, which costs the first night for each approved pet (excluding one-off extras).`,
};

const noShowLine = (schedule: FeeSchedule): string => NO_SHOW_LINES[schedule];

const paymentLine = (amount: number, paid: boolean): string =>
  paid
    ? `Payment: you've paid ${formatNzd(amount)}. Anything you don't owe after check-in goes back to your card.`
    : `Payment: we've held ${formatNzd(amount)} on your card. We charge it only when you check in.`;

export const dropOffReminderEmail = (
  details: BookingEmailDetails & {
    /** What cancelling costs at the time of sending; null when it can no longer be cancelled. */
    cancellationFee: number | null;
    /** Already charged (pay-at-request terms), not only held. */
    paid: boolean;
    schedule: FeeSchedule;
  },
): OutboundEmail => ({
  to: details.to,
  subject: `Your Wagstay stay starts ${formatNewZealandDay(details.dropOffAt)}: what to bring`,
  text: [
    greeting(details.firstName),
    '',
    'Your stay with Wagstay starts soon.',
    '',
    ...stayLines(details),
    '',
    ...DROP_OFF_ITEMS,
    '',
    noShowLine(details.schedule),
    '',
    paymentLine(details.amount, details.paid),
    ...(details.testMode ? ['This is a test booking: no real card was held.'] : []),
    '',
    `${cancellationLine(details.cancellationFee)}My Stays shows your current cancellation fee before you confirm. You can also request a date change, which needs manager approval.`,
    `For an emergency or a sick pet, ${reachUs(details.contact)}: we can cancel or move the stay without a fee.`,
  ].join('\n'),
});

/** The hold was refused: the booking stands, and the guest is asked for another card. */
export const cardHoldFailedEmail = (details: BookingEmailDetails): OutboundEmail => ({
  to: details.to,
  subject: "Action needed: we couldn't hold your card for your Wagstay stay",
  text: [
    greeting(details.firstName),
    '',
    `We tried to hold ${formatNzd(details.amount)} on your card for your stay, but your bank didn't allow it.`,
    `Your booking is still in place. To give us another card before check-in, ${reachUs(details.contact)}.`,
    ...(details.testMode ? ['This is a test booking: no real money moves.'] : []),
    '',
    ...stayLines(details),
    '',
    ...DROP_OFF_ITEMS,
  ].join('\n'),
});
