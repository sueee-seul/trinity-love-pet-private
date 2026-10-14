import { z } from 'zod';

/**
 * A guest cancelling or moving their own stay in My stays, and staff moving one without using the
 * guest's free change. Shared with the Frontend pet parent pages.
 */

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected an ISO date (YYYY-MM-DD)');

export const newDatesSchema = z
  .object({
    /** New drop-off date, YYYY-MM-DD in New Zealand. */
    startDate: isoDateSchema,
    /** New pick-up date, YYYY-MM-DD in New Zealand. */
    endDate: isoDateSchema,
  })
  .strict();

export type NewDates = z.infer<typeof newDatesSchema>;

/**
 * Amounts in NZD the page showed before the guest pressed the button. The server charges only
 * what the button said: when the amount has moved since the preview (a fee tier passed, a rate
 * changed), it answers 409 with the new amount instead of moving money (Fair Trading Act s 9).
 */
const previewedAmountSchema = z.number().nonnegative().finite().optional();

/** The body of POST .../cancel: the fee the guest saw, so a changed fee is confirmed again. */
export const cancelStaySchema = z.object({ expectedFee: previewedAmountSchema }).strict();

export type CancelStayInput = z.infer<typeof cancelStaySchema>;

/** The body of POST .../reschedule: the new dates and the total the guest saw for them. */
export const rescheduleStaySchema = newDatesSchema
  .extend({ expectedTotal: previewedAmountSchema })
  .strict();

export type RescheduleStayInput = z.infer<typeof rescheduleStaySchema>;

/** 409 codes that mean "look at the new amount and confirm again"; `details[0].amount` has it. */
export const CANCELLATION_FEE_CHANGED = 'CANCELLATION_FEE_CHANGED';
export const RESCHEDULE_PRICE_CHANGED = 'RESCHEDULE_PRICE_CHANGED';
export const EXTENSION_PRICE_CHANGED = 'EXTENSION_PRICE_CHANGED';
export const ADD_ON_PRICE_CHANGED = 'ADD_ON_PRICE_CHANGED';

// ----- Changes while the pet is staying -----------------------------------------------------------
//
// From check-in to check-out a parent can lengthen the stay, add a priced service for a day, or
// move the check-out time, each priced first (GET) and then applied with the amount they saw
// (POST). Money for these is its own row in the `booking_charges` ledger, never a rewrite of the
// stay's own payment: charged to the saved card at once, or, on a booking without a saved card,
// added to the bill and paid at the desk at check-out.

/** How a change is paid: charged to the saved card now, or at the desk at check-out. */
export type ChargeSettlement = 'card' | 'desk';

/** "HH:mm" on a 24-hour clock, New Zealand time. */
const wallClockSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected a time (HH:mm)');

/** GET .../extension?endDate=: the new pick-up date, after the booked one. */
export const extensionQuerySchema = z.object({ endDate: isoDateSchema }).strict();

/** POST .../extension: the new pick-up date and the price the dialog showed for the added nights. */
export const extendStaySchema = extensionQuerySchema
  .extend({ expectedAmount: previewedAmountSchema })
  .strict();

export type ExtendStayInput = z.infer<typeof extendStaySchema>;

/** The pet's part of an extension: nights added at the rate it booked. */
export interface ExtensionPetLine {
  bookingPetId: string;
  petName: string;
  nightlyRate: number;
  amount: number;
}

export interface ExtensionPreview {
  currentEndDate: string;
  newEndDate: string;
  addedNights: number;
  pets: ExtensionPetLine[];
  /** What the change costs, GST inclusive: charged to the card or added to the bill on confirm. */
  amount: number;
  settlement: ChargeSettlement;
}

export interface ExtensionResult extends ExtensionPreview {
  /** The ledger row of the charge, so a receipt can name it. */
  chargeId: string;
}

/** The add-ons a parent can book for a stay under way, each priced for one day or one stay. */
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
  /** The days the parent may choose: today up to the night before check-out, in New Zealand. */
  days: string[];
  settlement: ChargeSettlement;
}

/** POST .../pets/:bookingPetId/add-ons: one priced service for one day, confirmed at its price. */
export const addOnSchema = z
  .object({
    serviceId: z.string().uuid(),
    /** The day it happens, YYYY-MM-DD in New Zealand; today or later, inside the stay. */
    date: isoDateSchema,
    quantity: z.number().int().min(1).max(5).default(1),
    expectedAmount: previewedAmountSchema,
  })
  .strict();

export type AddOnInput = z.infer<typeof addOnSchema>;

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

/**
 * PATCH .../times: a new drop-off time (before drop-off only) or pick-up time (before pick-up),
 * on the booked dates. Nights are counted in Auckland dates, so neither changes the price.
 */
export const changeTimesSchema = z
  .object({ dropOffTime: wallClockSchema.optional(), pickUpTime: wallClockSchema.optional() })
  .strict()
  .refine((times) => times.dropOffTime !== undefined || times.pickUpTime !== undefined, {
    message: 'Choose a new check-in or check-out time',
  });

export type ChangeTimesInput = z.infer<typeof changeTimesSchema>;

export interface ChangeTimesResult {
  dropOffAt: string;
  pickUpAt: string;
}

/** Staff move a stay for an emergency, a red warning or a sick pet; it costs the guest nothing. */
export const staffRescheduleSchema = newDatesSchema
  .extend({ reason: z.string().trim().min(3, 'Say why the stay is moved').max(500) })
  .strict();

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

export interface ReschedulePreview {
  startDate: string;
  endDate: string;
  nights: number;
  /** The new total, at the rates the guest booked. */
  total: number;
  /** Whether this uses the one free change. A change staff make never does. */
  usesFreeReschedule: boolean;
  /** Earliest potential hold time (ISO), subject to manager reapproval. Older bookings only. */
  holdAt: string;
  /**
   * Paid at request (newer terms): the new price is held on the card at once, confirmed pets are
   * charged at the new price, and the old payment is released or refunded in full.
   */
  paysNow: boolean;
}

export interface RescheduleResult extends ReschedulePreview {
  /** Whether the new price is held (or charged) now; false while awaiting reapproval. */
  held: boolean;
}
