import type { PoolClient } from 'pg';
import { pool } from '../config/database.js';

export type BookingPetSpecies = 'dog' | 'cat' | 'other';

interface PetRow {
  id: string;
  name: string;
  species: BookingPetSpecies;
  breed: string | null;
  age: number | null;
  weight: number | null;
  imageUrl: string | null;
}

export interface BookingPetRecord {
  id: string;
  name: string;
  species: BookingPetSpecies;
  breed?: string;
  age?: number;
  weight?: number;
  imageUrl?: string;
}

// Optional fields are omitted (not sent as null) when the column is empty,
// matching the optional fields on the frontend `Pet` type.
const toBookingPetRecord = (row: PetRow): BookingPetRecord => {
  const record: BookingPetRecord = { id: row.id, name: row.name, species: row.species };
  if (row.breed !== null) record.breed = row.breed;
  if (row.age !== null) record.age = row.age;
  if (row.weight !== null) record.weight = row.weight;
  if (row.imageUrl !== null) record.imageUrl = row.imageUrl;
  return record;
};

export const listPetsForOwner = async (petOwnersUuid: string): Promise<BookingPetRecord[]> => {
  const result = await pool.query<PetRow>(
    `SELECT
        uuid::text AS id,
        name,
        CASE
          WHEN LOWER(COALESCE(species, '')) = 'dog' THEN 'dog'
          WHEN LOWER(COALESCE(species, '')) = 'cat' THEN 'cat'
          ELSE 'other'
        END AS species,
        breed,
        age,
        weight::float8 AS weight,
        image_url AS "imageUrl"
     FROM pets
     WHERE pet_owners_uuid = $1::uuid
     ORDER BY created_at DESC`,
    [petOwnersUuid],
  );
  return result.rows.map(toBookingPetRecord);
};

export const getOwnedPetIds = async (
  petOwnersUuid: string,
  petIds: string[],
): Promise<Set<string>> => {
  if (petIds.length === 0) return new Set();
  const result = await pool.query<{ id: string }>(
    `SELECT uuid::text AS id FROM pets WHERE pet_owners_uuid = $1::uuid AND uuid = ANY($2::uuid[])`,
    [petOwnersUuid, petIds],
  );
  return new Set(result.rows.map((row) => row.id));
};

export type BookingServiceCategory = 'boarding_rate' | 'food' | 'addon';

interface ServiceRow {
  id: string;
  name: string;
  description: string | null;
  category: BookingServiceCategory;
  price: number;
  priceUnit: string | null;
  compulsory: boolean;
}

export interface BookingServiceRecord {
  id: string;
  name: string;
  description?: string;
  category: BookingServiceCategory;
  price: number;
  priceUnit: string;
  compulsory: boolean;
}

const toBookingServiceRecord = (row: ServiceRow): BookingServiceRecord => {
  const record: BookingServiceRecord = {
    id: row.id,
    name: row.name,
    category: row.category,
    price: row.price,
    priceUnit: row.priceUnit ?? '',
    compulsory: row.compulsory,
  };
  if (row.description !== null) record.description = row.description;
  return record;
};

const SERVICE_ROW_QUERY = `
  SELECT
    uuid::text AS id,
    name,
    description,
    category,
    price::float8 AS price,
    price_unit AS "priceUnit",
    is_compulsory AS compulsory
  FROM services
`;

export const listServices = async (): Promise<BookingServiceRecord[]> => {
  const result = await pool.query<ServiceRow>(
    `${SERVICE_ROW_QUERY} ORDER BY priority NULLS LAST, name ASC`,
  );
  return result.rows.map(toBookingServiceRecord);
};

export interface ServiceCatalogEntry {
  name: string;
  price: number;
  priceUnit: string;
  category: BookingServiceCategory;
}

export const getServiceCatalogByIds = async (
  serviceIds: string[],
): Promise<Map<string, ServiceCatalogEntry>> => {
  if (serviceIds.length === 0) return new Map();
  const result = await pool.query<ServiceRow>(`${SERVICE_ROW_QUERY} WHERE uuid = ANY($1::uuid[])`, [
    serviceIds,
  ]);
  return new Map(
    result.rows.map((row) => [
      row.id,
      { name: row.name, price: row.price, priceUnit: row.priceUnit ?? '', category: row.category },
    ]),
  );
};

export interface CreateBookingPetInput {
  petId: string;
  dropOffAt: Date;
  pickUpAt: Date;
  /**
   * This pet's own review state when it differs from `recording.petReviewStatus`: the concierge
   * confirms some pets at once and leaves others for a manager. A confirmed pet's `approved_at`
   * is the time of the booking, which starts its fee windows.
   */
  reviewStatus?: BookingRecording['petReviewStatus'];
  services: { serviceId: string; quantity: number; priceAtBooking: number }[];
  info: {
    feedingRoutine: string;
    medInstruction: string;
    firstTimeBoarding: boolean | null;
    crateTrained: boolean | null;
    socialAllow: boolean | null;
    fullyVaccinated: boolean | null;
    behaveNHealth: string;
    others: string;
  };
}

export interface CreateBookingInput {
  petOwnersUuid: string;
  pets: CreateBookingPetInput[];
  agreement: {
    termsVersionsUuid: string;
    fullName: string;
    signatureUrl: string | null;
    agreedAt: Date;
  };
  /** Absent for a concierge request: nothing is paid online, the guest pays at the desk. */
  payment?: {
    processor: string;
    processorPaymentMethodId: string;
    amount: number;
    currency: string;
    /**
     * 'succeeded' (the default) for the classic form's completed payment. The concierge saves a
     * card ('pending') or, for a booking made inside the last 48 hours, holds it ('authorized').
     */
    status?: BookingPaymentStatus;
    /** The processor's hold, when one was placed at booking. */
    processorPaymentIntentId?: string | null;
  };
  /** How the booking is recorded; the classic form's paid, pending-review booking when omitted. */
  recording?: BookingRecording;
  /** Runs first inside the booking transaction, e.g. the capacity check under its lock. */
  beforeWrite?: (client: PoolClient) => Promise<void>;
}

export type BookingPaymentStatus = 'pending' | 'authorized' | 'succeeded';

/**
 * The classic form records a completed payment and leaves each pet for a manager to review. The
 * concierge books at once: the booking is confirmed and its pets are approved when it is written.
 */
export interface BookingRecording {
  bookingStatus: 'paid' | 'confirmed';
  petReviewStatus: 'pending' | 'approved';
}

const CLASSIC_BOOKING_RECORDING: BookingRecording = {
  bookingStatus: 'paid',
  petReviewStatus: 'pending',
};

export interface CreatedBookingRecord {
  bookingId: string;
  createdAt: string;
}

const insertPayment = async (
  client: PoolClient,
  petOwnersUuid: string,
  bookingUuid: string,
  payment: NonNullable<CreateBookingInput['payment']>,
): Promise<void> => {
  const paymentMethodResult = await client.query<{ uuid: string }>(
    `INSERT INTO payment_methods (pet_owners_uuid, is_default, processor, processor_payment_method_id)
     VALUES ($1::uuid, false, $2, $3)
     RETURNING uuid`,
    [petOwnersUuid, payment.processor, payment.processorPaymentMethodId],
  );
  const paymentMethod = paymentMethodResult.rows[0];
  if (!paymentMethod) {
    throw new Error('Payment method insert returned no row');
  }

  await client.query(
    `INSERT INTO booking_payments (
       payment_methods_uuid, bookings_uuid, amount, currency, status, processor_payment_intent_id
     )
     VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6)`,
    [
      paymentMethod.uuid,
      bookingUuid,
      payment.amount,
      payment.currency,
      payment.status ?? 'succeeded',
      payment.processorPaymentIntentId ?? null,
    ],
  );
};

// Runs the whole booking write (bookings, booking_pets, booking_pets_services,
// booking_pets_caring_info, bookings_agreements, payment_methods,
// booking_payments) as one transaction. Callers decide the payment state first
// (a completed payment, a saved card or a hold). This never writes a 'failed'
// booking_payments row, so a declined card never reaches here and nothing is
// persisted.
export const createBooking = async (input: CreateBookingInput): Promise<CreatedBookingRecord> => {
  const recording = input.recording ?? CLASSIC_BOOKING_RECORDING;
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query('BEGIN');
    transactionStarted = true;
    await input.beforeWrite?.(client);

    const bookingResult = await client.query<{ uuid: string; created_at: Date }>(
      `INSERT INTO bookings (pet_owners_uuid, status)
       VALUES ($1::uuid, 'draft')
       RETURNING uuid, created_at`,
      [input.petOwnersUuid],
    );
    const booking = bookingResult.rows[0];
    if (!booking) {
      throw new Error('Booking insert returned no row');
    }

    for (const pet of input.pets) {
      const bookingPetResult = await client.query<{ uuid: string }>(
        // pet_name keeps the stay readable if the parent later deletes the pet's profile.
        `INSERT INTO booking_pets (
           bookings_uuid, pet_uuid, pet_name, drop_off_time, pick_up_time, manager_review_status,
           approved_at
         )
         VALUES (
           $1::uuid, $2::uuid, (SELECT name FROM pets WHERE uuid = $2::uuid), $3, $4, $5::varchar,
           CASE WHEN $5::varchar = 'approved' THEN now() END
         )
         RETURNING uuid`,
        [
          booking.uuid,
          pet.petId,
          pet.dropOffAt,
          pet.pickUpAt,
          pet.reviewStatus ?? recording.petReviewStatus,
        ],
      );
      const bookingPet = bookingPetResult.rows[0];
      if (!bookingPet) {
        throw new Error('Booking pet insert returned no row');
      }

      for (const service of pet.services) {
        await client.query(
          `INSERT INTO booking_pets_services (booking_pets_uuid, services_uuid, quantity, price_at_booking)
           VALUES ($1::uuid, $2::uuid, $3, $4)`,
          [bookingPet.uuid, service.serviceId, service.quantity, service.priceAtBooking],
        );
      }

      await client.query(
        `INSERT INTO booking_pets_caring_info (
           booking_pets_uuid, feeding_routine, medication_instructions, first_time_boarding,
           crate_trained, other_notes, allows_socialization, fully_vaccinated, behavior_and_health_notes
         )
         VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          bookingPet.uuid,
          pet.info.feedingRoutine,
          pet.info.medInstruction,
          pet.info.firstTimeBoarding,
          pet.info.crateTrained,
          pet.info.others,
          pet.info.socialAllow,
          pet.info.fullyVaccinated,
          pet.info.behaveNHealth,
        ],
      );
    }

    await client.query(
      `INSERT INTO bookings_agreements (bookings_uuid, terms_versions_uuid, signature_url, full_name, agreed_at)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5)`,
      [
        booking.uuid,
        input.agreement.termsVersionsUuid,
        input.agreement.signatureUrl,
        input.agreement.fullName,
        input.agreement.agreedAt,
      ],
    );

    if (input.payment) {
      await insertPayment(client, input.petOwnersUuid, booking.uuid, input.payment);
    }

    await client.query(`UPDATE bookings SET status = $2 WHERE uuid = $1::uuid`, [
      booking.uuid,
      recording.bookingStatus,
    ]);

    await client.query('COMMIT');
    transactionStarted = false;

    return { bookingId: booking.uuid, createdAt: booking.created_at.toISOString() };
  } catch (error) {
    if (transactionStarted) {
      await client.query('ROLLBACK').catch(() => {});
    }
    throw error;
  } finally {
    client.release();
  }
};
