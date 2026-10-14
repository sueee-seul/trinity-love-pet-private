import type { ManagerBookingRecord } from '../types/booking';

type BookingOverrides = Partial<ManagerBookingRecord['booking']>;

/**
 * A pet on a booking made with a saved card: drop-off 10:30 on Sat 12 Dec 2026 in Auckland, $230
 * for this pet, and a $460 hold for the two-pet booking.
 */
export const cardBookingPet = (
  overrides: Partial<Omit<ManagerBookingRecord, 'booking'>> & { booking?: BookingOverrides } = {},
): ManagerBookingRecord => {
  const { booking, ...rest } = overrides;
  return {
    booking_pets_uuid: 'bp-biscuit',
    booking_id: 'booking-1',
    customer: {
      id: 'owner-1',
      name: 'Ava Mitchell',
      contact: { email: 'ava@example.test', phone: null },
    },
    pet: { id: 'pet-biscuit', name: 'Biscuit', type: 'dog' },
    ...rest,
    booking: {
      dates: { check_in: '2026-12-12', check_out: '2026-12-15' },
      booking_caring_info: {
        first_time_boarding: false,
        crate_trained: false,
        allows_socialization: false,
        fully_vaccinated: false,
        feeding_routine: '',
        medication_instructions: null,
        behavior_and_health_notes: null,
        other_notes: null,
        has_vaccination_certificate: false,
        vaccination_document_uploaded_at: null,
      },
      services: { boarding_rate: null, food: null, addons: [] },
      status: 'confirmed',
      manager_review_status: 'approved',
      refusal_reason: null,
      reviewer_name: null,
      check_in_outcome: null,
      drop_off_at: '2026-12-11T21:30:00Z',
      pet_price: 230,
      // $60 a night for three nights plus a $50 flat extra: a no-show costs one night, $60.
      pet_nightly_rate: 60,
      card_guarantee: {
        status: 'authorized',
        amount: 460,
        captured_amount: null,
        test_mode: true,
        pays_at_request: false,
      },
      to_pay_at_check_out: 0,
      ...booking,
    },
  };
};

/** The second pet on the same booking. */
export const cardBookingSecondPet = (booking: BookingOverrides = {}): ManagerBookingRecord =>
  cardBookingPet({
    booking_pets_uuid: 'bp-mochi',
    pet: { id: 'pet-mochi', name: 'Mochi', type: 'cat' },
    booking,
  });
