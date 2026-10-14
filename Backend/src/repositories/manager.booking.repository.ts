import { pool } from '../config/database.js';
import {
  PAY_AT_REQUEST_TERMS_VERSION,
  TERMS_VERSION_LABEL_SQL,
} from './booking.agreement.repository.js';
import { DESK_PROCESSOR } from './booking.charges.repository.js';
import type { CheckInOutcome } from '../contracts/booking.check-in.contract.js';
import {
  AUCKLAND_NIGHTS,
  CARD_GUARANTEE_PROCESSORS,
  cardGuaranteeJoin,
  PET_NIGHTLY_RATE_SQL,
  PET_PRICE_SQL,
  type CardGuaranteeStatus,
} from './booking.check-in.repository.js';

interface ServiceRef {
  services_uuid: string;
  services_name: string;
  price: number;
  priceUnit: string;
  frequency: number;
}

//Add manager permission
interface ManagerBookingRow {
  booking_pets_uuid: string;
  booking_id: string;
  customer_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  /** Null once the parent has deleted the pet's profile; the stay stays on record. */
  pet_id: string | null;
  pet_name: string;
  pet_type: string;
  pet_breed: string | null;
  pet_age: number | null;
  pet_weight: number | null;
  pet_gender: boolean | null;
  pet_colour: string | null;
  pet_status: string;
  pet_diet_notes: string | null;
  pet_allergies: string | null;
  pet_behaviour_notes: string | null;
  pet_desexed: boolean;
  pet_microchip_number: string | null;
  pet_vet_name: string | null;
  pet_vet_phone: string | null;
  pet_health_notes: string | null;
  check_in: string | null;
  check_out: string | null;
  feeding_routine: string | null;
  medication_instructions: string | null;
  first_time_boarding: boolean | null;
  crate_trained: boolean | null;
  other_notes: string | null;
  allows_socialization: boolean | null;
  fully_vaccinated: boolean | null;
  behavior_and_health_notes: string | null;
  has_vaccination_certificate: boolean;
  vaccination_document_uploaded_at: Date | null;
  manager_review_status: string;
  refusal_reason: string | null;
  reviewer_name: string | null;
  // These three come back as ready-built JSON from Postgres (see the query
  // below); `pg` parses json/jsonb columns into plain JS values for us.
  boarding_rate: ServiceRef | null;
  food: ServiceRef | null;
  addons: ServiceRef[];
  status: string;
  check_in_outcome: CheckInOutcome | null;
  drop_off_at: string | null;
  pet_price: number;
  pet_nightly_rate: number;
  card_status: CardGuaranteeStatus | null;
  card_amount: number | null;
  card_captured_amount: number | null;
  card_test_mode: boolean | null;
  pays_at_request: boolean;
  to_pay_at_check_out: number;
}

/** The saved card that guarantees a booking, as the desk sees it. */
export interface CardGuaranteeSummary {
  status: CardGuaranteeStatus;
  amount: number;
  /** What was taken at check-in or cancellation (0: released in full); null until settled. */
  captured_amount: number | null;
  test_mode: boolean;
  /**
   * Agreed to the pay-at-request terms: held at request, charged on confirmation, tiered fees
   * (a no-show costs half the stay). Older bookings: held 48 hours ahead, charged at the desk.
   */
  pays_at_request: boolean;
}

//Add manager permission
export interface ManagerBookingRecord {
  booking_pets_uuid: string;
  booking_id: string;
  customer: {
    id: string;
    name: string;
    contact: {
      email: string;
      phone: string | null;
    };
  };
  pet: {
    /** Null once the parent has deleted the pet's profile; the stay stays on record. */
    id: string | null;
    name: string;
    type: string;
    details: {
      breed: string | null;
      age: number | null;
      weight: number | null;
      gender: boolean | null;
      colour: string | null;
      status: string;
      diet_notes: string | null;
      allergies: string | null;
      behaviour_notes: string | null;
      desexed: boolean;
      microchip_number: string | null;
      vet_name: string | null;
      vet_phone: string | null;
      health_notes: string | null;
    };
  };
  booking: {
    dates: {
      check_in: string | null;
      check_out: string | null;
    };
    // Every column on booking_pets_caring_info, always present: null when
    // the pet has no caring-info row at all (LEFT JOIN below) or when an
    // individual field was left blank. The certificate's private storage key
    // is never sent: staff open the file through
    // GET /api/admin/vaccination-certificates/:bookingPetId instead.
    booking_caring_info: {
      feeding_routine: string | null;
      medication_instructions: string | null;
      first_time_boarding: boolean | null;
      crate_trained: boolean | null;
      other_notes: string | null;
      allows_socialization: boolean | null;
      fully_vaccinated: boolean | null;
      behavior_and_health_notes: string | null;
      has_vaccination_certificate: boolean;
      vaccination_document_uploaded_at: string | null;
    };
    services: {
      boarding_rate: ServiceRef | null;
      food: ServiceRef | null;
      addons: ServiceRef[];
    };
    status: string;
    manager_review_status: string;
    /** Why the pet was refused, or why staff cancelled the booking without a fee. */
    refusal_reason: string | null;
    /** The manager who approved or refused, by name; null while pending or confirmed at checkout. */
    reviewer_name: string | null;
    check_in_outcome: CheckInOutcome | null;
    /** The drop-off instant (ISO, UTC), so the desk knows from when arrivals can be recorded. */
    drop_off_at: string | null;
    /** This pet's share of the booking total, in NZD. */
    pet_price: number;
    /** One night of this pet's per-night lines: a no-show costs this, capped at `pet_price`. */
    pet_nightly_rate: number;
    /** Null for bookings made without a saved card (the classic form). */
    card_guarantee: CardGuaranteeSummary | null;
    /**
     * In-stay changes on a booking without a saved card (extra nights, add-ons), owed by the whole
     * booking and taken at the desk at check-out, in NZD; 0 when nothing is owed.
     */
    to_pay_at_check_out: number;
  };
}

//Add manager permission
const toManagerBookingRecord = (row: ManagerBookingRow): ManagerBookingRecord => ({
  booking_pets_uuid: row.booking_pets_uuid,
  booking_id: row.booking_id,
  customer: {
    id: row.customer_id,
    name: row.customer_name,
    contact: {
      email: row.customer_email,
      phone: row.customer_phone,
    },
  },
  pet: {
    id: row.pet_id,
    name: row.pet_name,
    type: row.pet_type,
    details: {
      breed: row.pet_breed,
      age: row.pet_age,
      weight: row.pet_weight,
      gender: row.pet_gender,
      colour: row.pet_colour,
      status: row.pet_status,
      diet_notes: row.pet_diet_notes,
      allergies: row.pet_allergies,
      behaviour_notes: row.pet_behaviour_notes,
      desexed: row.pet_desexed,
      microchip_number: row.pet_microchip_number,
      vet_name: row.pet_vet_name,
      vet_phone: row.pet_vet_phone,
      health_notes: row.pet_health_notes,
    },
  },
  booking: {
    dates: {
      check_in: row.check_in,
      check_out: row.check_out,
    },
    booking_caring_info: {
      feeding_routine: row.feeding_routine,
      medication_instructions: row.medication_instructions,
      first_time_boarding: row.first_time_boarding,
      crate_trained: row.crate_trained,
      other_notes: row.other_notes,
      allows_socialization: row.allows_socialization,
      fully_vaccinated: row.fully_vaccinated,
      behavior_and_health_notes: row.behavior_and_health_notes,
      has_vaccination_certificate: row.has_vaccination_certificate,
      vaccination_document_uploaded_at: row.vaccination_document_uploaded_at?.toISOString() ?? null,
    },
    services: {
      boarding_rate: row.boarding_rate,
      food: row.food,
      addons: row.addons,
    },
    status: row.status,
    manager_review_status: row.manager_review_status,
    refusal_reason: row.refusal_reason,
    reviewer_name: row.reviewer_name,
    check_in_outcome: row.check_in_outcome,
    drop_off_at: row.drop_off_at,
    pet_price: row.pet_price,
    pet_nightly_rate: row.pet_nightly_rate,
    card_guarantee:
      row.card_status === null || row.card_amount === null
        ? null
        : {
            status: row.card_status,
            amount: row.card_amount,
            captured_amount: row.card_captured_amount,
            test_mode: row.card_test_mode === true,
            pays_at_request: row.pays_at_request,
          },
    to_pay_at_check_out: row.to_pay_at_check_out,
  },
});

// One row per booking_pets: a booking with multiple pets produces one
// record per pet, each carrying its own dates/caring-info/services, same
// granularity the pet-parent "My Stays" view uses. Paid bookings (classic
// form) and confirmed bookings (concierge, booked at once) are surfaced
// here: the bookings a pet parent has completed, never in-progress drafts.
const MANAGER_BOOKING_QUERY = `
  SELECT
    bp.uuid::text AS booking_pets_uuid,
    b.uuid::text AS booking_id,
    po.users_uuid::text AS customer_id,
    concat_ws(' ', po.first_name, po.last_name) AS customer_name,
    u.email AS customer_email,
    u.phone AS customer_phone,
    p.uuid::text AS pet_id,
    COALESCE(p.name, bp.pet_name, 'Deleted pet') AS pet_name,
    LOWER(COALESCE(p.species, '')) AS pet_type,
    p.breed AS pet_breed,
    p.age AS pet_age,
    p.weight::float8 AS pet_weight,
    p.gender AS pet_gender,
    p.colour AS pet_colour,
    COALESCE(p.status, 'deleted') AS pet_status,
    p.diet_notes AS pet_diet_notes,
    p.allergies AS pet_allergies,
    p.behaviour_notes AS pet_behaviour_notes,
    COALESCE(p.desexed, false) AS pet_desexed,
    p.microchip_number AS pet_microchip_number,
    p.vet_name AS pet_vet_name,
    p.vet_phone AS pet_vet_phone,
    p.health_notes AS pet_health_notes,
    to_char(bp.drop_off_time AT TIME ZONE 'Pacific/Auckland', 'YYYY-MM-DD') AS check_in,
    to_char(bp.pick_up_time AT TIME ZONE 'Pacific/Auckland', 'YYYY-MM-DD') AS check_out,
    ci.feeding_routine,
    ci.medication_instructions,
    ci.first_time_boarding,
    ci.crate_trained,
    ci.other_notes,
    ci.allows_socialization,
    ci.fully_vaccinated,
    ci.behavior_and_health_notes,
    (ci.vaccination_document_url IS NOT NULL) AS has_vaccination_certificate,
    ci.vaccination_document_uploaded_at,
    (
      SELECT json_build_object(
        'services_uuid', s.uuid::text,
        'services_name', s.name,
        'price', bps.price_at_booking::float8,
        'priceUnit', s.price_unit,
        'frequency', CASE
          WHEN s.price_unit IN ('per night', 'per day') THEN bpn.nights
          WHEN s.price_unit = 'per walk' THEN bps.quantity
          ELSE 1
        END
      )
      FROM booking_pets_services bps
      JOIN services s ON s.uuid = bps.services_uuid
      WHERE bps.booking_pets_uuid = bp.uuid AND s.category = 'boarding_rate'
      ORDER BY bps.created_at
      LIMIT 1
    ) AS boarding_rate,
    (
      SELECT json_build_object(
        'services_uuid', s.uuid::text,
        'services_name', s.name,
        'price', bps.price_at_booking::float8,
        'priceUnit', s.price_unit,
        'frequency', CASE
          WHEN s.price_unit IN ('per night', 'per day') THEN bpn.nights
          WHEN s.price_unit = 'per walk' THEN bps.quantity
          ELSE 1
        END
      )
      FROM booking_pets_services bps
      JOIN services s ON s.uuid = bps.services_uuid
      WHERE bps.booking_pets_uuid = bp.uuid AND s.category = 'food'
      ORDER BY bps.created_at
      LIMIT 1
    ) AS food,
    (
      SELECT COALESCE(
        json_agg(
          json_build_object(
            'services_uuid', s.uuid::text,
            'services_name', s.name,
            'price', bps.price_at_booking::float8,
            'priceUnit', s.price_unit,
            'frequency', CASE
              WHEN s.price_unit IN ('per night', 'per day') THEN bpn.nights
              WHEN s.price_unit = 'per walk' THEN bps.quantity
              ELSE 1
            END
          )
          ORDER BY bps.created_at
        ),
        '[]'::json
      )
      FROM booking_pets_services bps
      JOIN services s ON s.uuid = bps.services_uuid
      WHERE bps.booking_pets_uuid = bp.uuid AND s.category = 'addon'
    ) AS addons,
    b.status,
    bp.manager_review_status,
    bp.refusal_reason,
    COALESCE(reviewer.display_name, reviewer.username) AS reviewer_name,
    bp.check_in_outcome,
    to_char(bp.drop_off_time AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS drop_off_at,
    (${PET_PRICE_SQL})::float8 AS pet_price,
    (${PET_NIGHTLY_RATE_SQL})::float8 AS pet_nightly_rate,
    guarantee.status AS card_status,
    guarantee.amount::float8 AS card_amount,
    guarantee.captured_amount::float8 AS card_captured_amount,
    CASE WHEN guarantee.processor = 'fake' THEN TRUE ELSE $2::boolean END AS card_test_mode,
    COALESCE(${TERMS_VERSION_LABEL_SQL}, '') >= $3 AS pays_at_request,
    (
      SELECT COALESCE(SUM(bc.amount), 0)
        FROM booking_charges bc
       WHERE bc.bookings_uuid = b.uuid AND bc.processor = $4
    )::float8 AS to_pay_at_check_out
  FROM booking_pets bp
  JOIN bookings b ON b.uuid = bp.bookings_uuid
  -- LEFT: a pet whose profile the parent deleted keeps its stays on record.
  LEFT JOIN pets p ON p.uuid = bp.pet_uuid
  JOIN pet_owners po ON po.users_uuid = b.pet_owners_uuid
  JOIN users u ON u.uuid = po.users_uuid
  LEFT JOIN booking_pets_caring_info ci ON ci.booking_pets_uuid = bp.uuid
  LEFT JOIN users reviewer ON reviewer.uuid = bp.reviewed_by_uuid
  -- Nights charged for this pet's stay, in Auckland dates as it was priced (a UTC date is a day
  -- early for any morning drop-off); defaults to 1 if either date is missing.
  CROSS JOIN LATERAL (
    SELECT ${AUCKLAND_NIGHTS} AS nights
  ) bpn
  ${cardGuaranteeJoin('$1')}
  LEFT JOIN bookings_agreements ba ON ba.bookings_uuid = b.uuid
  LEFT JOIN terms_versions tv ON tv.uuid = ba.terms_versions_uuid
  WHERE b.status IN ('paid', 'confirmed')
  ORDER BY bp.created_at DESC
`;

export const listAllBookings = async (options: {
  stripeTestMode: boolean;
}): Promise<ManagerBookingRecord[]> => {
  const result = await pool.query<ManagerBookingRow>(MANAGER_BOOKING_QUERY, [
    CARD_GUARANTEE_PROCESSORS,
    options.stripeTestMode,
    PAY_AT_REQUEST_TERMS_VERSION,
    DESK_PROCESSOR,
  ]);
  return result.rows.map(toManagerBookingRecord);
};
