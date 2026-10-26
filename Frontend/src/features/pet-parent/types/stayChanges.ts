/** A guest cancelling or moving their own stay (Backend contracts/booking.change.contract.ts). */

export interface TeamContactDetails {
  email: string | null;
  phone: string | null;
}

/**
 * - pending_request: no pet is approved yet; withdrawing the request is free.
 * - early: 72 hours or more before drop-off, free.
 * - approval_grace: within 2 hours of approval, free.
 * - cooling_off: within 24 hours of approval, for a stay approved 72 hours or more ahead, free.
 * - approval_time_unknown: approved before approval times were recorded; free, because the grace
 *   and cooling-off windows cannot be worked out.
 * - late: later than that; one night per approved pet.
 */
/** Why cancelling costs what it does: a free window, one night per pet, or half of each stay. */
export type GuestCancellationRule =
  | 'pending_request'
  | 'early'
  | 'approval_grace'
  | 'cooling_off'
  | 'approval_time_unknown'
  | 'late'
  | 'short_notice';

export interface CancellationPreview {
  /** What cancelling now costs, in NZD; 0 when it is free. */
  fee: number;
  rule: GuestCancellationRule;
  total: number;
  /** For an emergency or a sick pet: staff can cancel without a fee. */
  contact: TeamContactDetails;
}

export interface CancellationResult {
  fee: number;
}

/** POST .../cancel: the fee the dialog showed; the server refuses to charge a different one. */
export interface CancelStayInput {
  expectedFee?: number;
}

export interface NewDates {
  /** YYYY-MM-DD in New Zealand. */
  startDate: string;
  endDate: string;
}

/** POST .../reschedule: the dates and the total the dialog showed for them. */
export interface RescheduleStayInput extends NewDates {
  expectedTotal?: number;
}

/**
 * 409 codes that mean the amount moved while the dialog was open (a fee tier passed, a rate
 * changed). Nothing was charged; the dialog prices again and asks once more.
 */
export const CANCELLATION_FEE_CHANGED = 'CANCELLATION_FEE_CHANGED';
export const RESCHEDULE_PRICE_CHANGED = 'RESCHEDULE_PRICE_CHANGED';

export interface ReschedulePreview extends NewDates {
  nights: number;
  /** The new total, at the rates booked. */
  total: number;
  usesFreeReschedule: boolean;
  /** ISO instant the new price is held: 48 hours before drop-off, or now. Older bookings only. */
  holdAt: string;
  /**
   * Paid at request (newer terms): the new price is held at once, confirmed pets are charged at
   * the new price, and the old payment is released or refunded. Decisions stay as they were.
   */
  paysNow: boolean;
}

export interface RescheduleResult extends ReschedulePreview {
  held: boolean;
}

// ----- Changes while the pet is staying ---------------------------------------------------------
//
// From check-in to check-out a parent can lengthen the stay, add a priced service for a day, or
// move the check-in or check-out time. Each is priced first (GET) and applied with the amount the
// parent saw (POST). The amount is charged to the saved card as its own charge, or, on a booking
// without a saved card, added to the bill and paid at the desk at check-out.

/** How a change is paid: charged to the saved card now, or at the desk at check-out. */
export type ChargeSettlement = 'card' | 'desk';

/** 409 codes for an in-stay change whose amount moved while the dialog was open. */
export const EXTENSION_PRICE_CHANGED = 'EXTENSION_PRICE_CHANGED';
export const ADD_ON_PRICE_CHANGED = 'ADD_ON_PRICE_CHANGED';

/** The pet's part of an extension: nights added at the rate it booked. */
export interface ExtensionPetLine {
  bookingPetId: string;
  petName: string;
  nightlyRate: number;
  amount: number;
}

export interface ExtensionPreview {
  /** YYYY-MM-DD in New Zealand. */
  currentEndDate: string;
  newEndDate: string;
  addedNights: number;
  pets: ExtensionPetLine[];
  /** What the change costs, GST inclusive: charged to the card or added to the bill on confirm. */
  amount: number;
  settlement: ChargeSettlement;
}

export interface ExtensionResult extends ExtensionPreview {
  /** The ledger row of the charge. */
  chargeId: string;
}

/** POST .../extension: the new check-out date and the price the dialog showed for the added nights. */
export interface ExtendStayInput {
  endDate: string;
  expectedAmount?: number;
}

/** An add-on a parent can book for a stay under way, priced for one day or one stay. */
export interface AddOnOffer {
  serviceId: string;
  name: string;
  description: string | null;
  /** The price of one, GST inclusive: for one day ('per day') or for the stay ('per stay'). */
  price: number;
  priceUnit: string;
}

export interface AddOnCatalogue {
  offers: AddOnOffer[];
  /** The days the parent may choose, YYYY-MM-DD: today up to the night before check-out. */
  days: string[];
  settlement: ChargeSettlement;
}

/** POST .../pets/:bookingPetId/add-ons: one priced service for one day, confirmed at its price. */
export interface AddOnInput {
  serviceId: string;
  date: string;
  quantity: number;
  expectedAmount?: number;
}

export interface AddOnResult {
  chargeId: string;
  bookingPetId: string;
  petName: string;
  serviceName: string;
  date: string;
  quantity: number;
  amount: number;
  /** The care task staff see, when one was created. */
  taskId: string | null;
  settlement: ChargeSettlement;
}

/** PATCH .../times: "HH:mm" on New Zealand wall clock; at least one of the two. */
export interface ChangeTimesInput {
  dropOffTime?: string;
  pickUpTime?: string;
}

export interface ChangeTimesResult {
  /** ISO instants. */
  dropOffAt: string;
  pickUpAt: string;
}

// ----- Change requests while the pet is staying -------------------------------------------------
//
// Since 2026-10-14 each change above is a request: the POST saves it, our manager approves or
// refuses it, and only then does the stay change. Mirrors Backend contracts/booking.change.contract.ts.

export type StayChangeRequestStatus = 'pending' | 'approved' | 'refused' | 'cancelled';

export type StayChangeRequestDetails =
  | { kind: 'extend'; endDate: string }
  | { kind: 'add_on'; serviceId: string; serviceName: string; date: string; quantity: number }
  | { kind: 'times'; dropOffTime?: string; pickUpTime?: string }
  | { kind: 'early_check_out' };

export interface StayChangeRequest {
  id: string;
  bookingId: string;
  /** The pet an add-on or a time is for; null for a change to the whole stay. */
  bookingPetId: string | null;
  details: StayChangeRequestDetails;
  /** What it costs if approved, paid at the desk at check-out; null when it costs nothing. */
  quotedAmount: number | null;
  status: StayChangeRequestStatus;
  refusalReason: string | null;
  /** One English line, e.g. "extend Max's stay to 17 Oct 2026 ($55.00)". */
  summary: string;
  createdAt: string;
  decidedAt: string | null;
}
