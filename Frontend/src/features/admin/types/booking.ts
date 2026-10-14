export interface PricedService {
  services_uuid: string;
  services_name: string;
  price: number;
  priceUnit: string;
  frequency: number;
}

/** 'cancelled': staff cancelled the whole booking without a fee (emergency, red warning, sick pet). */
export type ManagerReviewStatus = 'pending' | 'approved' | 'refused' | 'cancelled';

/** What staff record at the desk (Backend contracts/booking.check-in.contract.ts). */
export type CheckInOutcome = 'checked_in' | 'no_show' | 'wagstay_unable';

export type CardGuaranteeStatus =
  'pending' | 'authorized' | 'succeeded' | 'canceled' | 'failed' | 'refunded';

/** The saved card behind a booking made on the booking page. */
export interface CardGuaranteeSummary {
  status: CardGuaranteeStatus;
  amount: number;
  /** What check-in or a cancellation took (0: released in full); null until then. */
  captured_amount: number | null;
  test_mode: boolean;
  /**
   * Agreed to the pay-at-request terms (Backend manager.booking.repository.ts): held at request,
   * charged on confirmation, a no-show costs half the stay. Older bookings: held 48 hours ahead,
   * charged at the desk, a no-show costs the first night.
   */
  pays_at_request: boolean;
}

export type FinishCheckInResult = 'charged' | 'released' | 'declined' | 'card_failed';

export interface FinishCheckInResponse {
  result: FinishCheckInResult;
  amount: number;
}

/** Moving a stay without a charge, for an emergency, a red warning or a sick pet. */
export interface StaffReschedule {
  /** YYYY-MM-DD in New Zealand. */
  startDate: string;
  endDate: string;
  reason: string;
}

export interface StaffRescheduleResponse {
  startDate: string;
  endDate: string;
  nights: number;
  total: number;
}

export interface ManagerBookingRecord {
  booking_pets_uuid: string;
  booking_id: string;
  customer: {
    id: string;
    name: string;
    contact: { email: string; phone: string | null };
  };

  pet: {
    /** Null once the parent has deleted the pet's profile; the stay stays on record. */
    id: string | null;
    name: string;
    type: string;
  };

  booking: {
    dates: { check_in: string | null; check_out: string | null };
    booking_caring_info: {
      first_time_boarding: boolean;
      crate_trained: boolean;
      allows_socialization: boolean;
      fully_vaccinated: boolean;
      feeding_routine: string;
      medication_instructions: string | null;
      behavior_and_health_notes: string | null;
      other_notes: string | null;
      /** A parent uploaded a certificate for this stay; open it with vaccinationCertificateUrl. */
      has_vaccination_certificate: boolean;
      vaccination_document_uploaded_at: string | null;
    };
    services: {
      boarding_rate: PricedService | null;
      food: PricedService | null;
      addons: PricedService[];
    };
    status: string;
    manager_review_status: ManagerReviewStatus;
    /** Why the pet was refused, or why staff cancelled the booking without a fee. */
    refusal_reason: string | null;
    /** The manager who approved or refused; null while pending or when confirmed at checkout. */
    reviewer_name: string | null;
    check_in_outcome: CheckInOutcome | null;
    /** ISO instant of the drop-off. */
    drop_off_at: string | null;
    /** This pet's share of the booking, in NZD. */
    pet_price: number;
    /** One night of this pet's per-night lines, in NZD: what a no-show costs (capped at `pet_price`). */
    pet_nightly_rate: number;
    /** Null for bookings made without a saved card. */
    card_guarantee: CardGuaranteeSummary | null;
    /** In-stay changes on a booking without a saved card, owed at the desk at check-out, in NZD. */
    to_pay_at_check_out: number;
  };
}

export type ManagerBookingTab = 'Booking' | 'Approve' | 'Refuse' | 'Cancelled';

/**
 * Each tab and each card name a request by its state, in the words the pet's owner reads where they
 * match: "Waiting for review" and "Confirmed" (Frontend pet-parent stayStatus.ts).
 */
export const MANAGER_REVIEW_LABELS: Record<ManagerReviewStatus, string> = {
  pending: 'Waiting for review',
  approved: 'Confirmed',
  refused: 'Refused',
  cancelled: 'Cancelled',
};

export const BOOKING_TAB_TO_STATUS: Record<ManagerBookingTab, ManagerReviewStatus> = {
  Booking: 'pending',
  Approve: 'approved',
  Refuse: 'refused',
  Cancelled: 'cancelled',
};
