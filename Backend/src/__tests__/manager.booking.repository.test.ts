import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));
vi.mock('../config/database.js', () => ({ pool: { query: queryMock } }));

import { listAllBookings } from '../repositories/manager.booking.repository.js';

const ROW = {
  booking_pets_uuid: 'bp-max',
  booking_id: 'booking-1',
  customer_id: 'owner-1',
  customer_name: 'Jane Rivera',
  customer_email: 'jane@example.test',
  customer_phone: null,
  pet_id: 'pet-max',
  pet_name: 'Max',
  pet_type: 'dog',
  pet_breed: null,
  pet_age: null,
  pet_weight: null,
  pet_gender: null,
  pet_colour: null,
  pet_status: 'incoming',
  pet_diet_notes: null,
  pet_allergies: null,
  pet_behaviour_notes: null,
  pet_desexed: false,
  pet_microchip_number: null,
  pet_vet_name: null,
  pet_vet_phone: null,
  pet_health_notes: null,
  check_in: '2026-10-12',
  check_out: '2026-10-15',
  feeding_routine: null,
  medication_instructions: null,
  first_time_boarding: null,
  crate_trained: null,
  other_notes: null,
  allows_socialization: null,
  fully_vaccinated: true,
  behavior_and_health_notes: null,
  has_vaccination_certificate: true,
  vaccination_document_uploaded_at: new Date('2026-09-29T01:00:00.000Z'),
  manager_review_status: 'pending',
  refusal_reason: null,
  boarding_rate: null,
  food: null,
  addons: [],
  status: 'paid',
  pet_price: 230,
  pet_nightly_rate: 60,
  to_pay_at_check_out: 0,
};

beforeEach(() => {
  queryMock.mockReset();
});

describe('listAllBookings', () => {
  it('tells the manager a certificate is on file and when, without its storage key', async () => {
    queryMock.mockResolvedValue({ rows: [ROW] });

    const [record] = await listAllBookings({ stripeTestMode: false });

    expect(record?.booking.booking_caring_info).toMatchObject({
      fully_vaccinated: true,
      has_vaccination_certificate: true,
      vaccination_document_uploaded_at: '2026-09-29T01:00:00.000Z',
    });
    expect(record?.booking.booking_caring_info).not.toHaveProperty('vaccination_document_url');
    const sql = String(queryMock.mock.calls[0]?.[0]);
    expect(sql).not.toMatch(/ci\.vaccination_document_url\s*,/);
  });

  it('reports no certificate for a pet without one', async () => {
    queryMock.mockResolvedValue({
      rows: [
        { ...ROW, has_vaccination_certificate: false, vaccination_document_uploaded_at: null },
      ],
    });

    const [record] = await listAllBookings({ stripeTestMode: false });

    expect(record?.booking.booking_caring_info).toMatchObject({
      has_vaccination_certificate: false,
      vaccination_document_uploaded_at: null,
    });
  });

  it('gives the desk the per-night part of each pet, the base of its no-show fee', async () => {
    queryMock.mockResolvedValue({ rows: [ROW] });

    const [record] = await listAllBookings({ stripeTestMode: false });

    expect(record?.booking).toMatchObject({ pet_price: 230, pet_nightly_rate: 60 });
    const sql = String(queryMock.mock.calls[0]?.[0]);
    expect(sql).toContain('AS pet_nightly_rate');
    expect(sql).toContain("s.price_unit IN ('per night', 'per day')");
  });

  it('tells the desk what in-stay changes are owed at check-out on a booking without a card', async () => {
    queryMock.mockResolvedValue({ rows: [{ ...ROW, to_pay_at_check_out: 45 }] });

    const [record] = await listAllBookings({ stripeTestMode: false });

    expect(record?.booking.to_pay_at_check_out).toBe(45);
    const sql = String(queryMock.mock.calls[0]?.[0]);
    expect(sql).toContain('AS to_pay_at_check_out');
    expect(queryMock.mock.calls[0]?.[1]).toContain('desk');
  });
});
