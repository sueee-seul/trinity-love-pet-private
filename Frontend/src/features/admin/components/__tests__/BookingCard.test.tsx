import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BookingCard } from '../booking/BookingCard';
import type { ManagerBookingRecord } from '../../types/booking';

const BOOKING_PET_ID = '00000000-0000-4000-8000-000000000601';

const booking = (
  caringInfo: Partial<ManagerBookingRecord['booking']['booking_caring_info']>,
): ManagerBookingRecord => ({
  booking_pets_uuid: BOOKING_PET_ID,
  booking_id: 'booking-1',
  customer: {
    id: 'owner-1',
    name: 'Jane Rivera',
    contact: { email: 'jane@example.com', phone: null },
  },
  pet: { id: 'pet-max', name: 'Max', type: 'dog' },
  booking: {
    dates: { check_in: '2026-10-12', check_out: '2026-10-15' },
    booking_caring_info: {
      first_time_boarding: false,
      crate_trained: false,
      allows_socialization: false,
      fully_vaccinated: false,
      feeding_routine: 'Twice a day',
      medication_instructions: null,
      behavior_and_health_notes: null,
      other_notes: null,
      has_vaccination_certificate: false,
      vaccination_document_uploaded_at: null,
      ...caringInfo,
    },
    services: { boarding_rate: null, food: null, addons: [] },
    status: 'paid',
    manager_review_status: 'pending',
    refusal_reason: null,
    reviewer_name: null,
    // Booked before the card guarantee: no desk or card actions.
    check_in_outcome: null,
    drop_off_at: null,
    pet_price: 180,
    pet_nightly_rate: 60,
    card_guarantee: null,
    to_pay_at_check_out: 0,
  },
});

const renderCard = (record: ManagerBookingRecord): ReturnType<typeof render> =>
  render(
    <MemoryRouter>
      <BookingCard
        booking={record}
        petsOfBooking={[record]}
        isFirstOfBooking
        now={new Date('2026-10-01T00:00:00Z')}
        onApprove={vi.fn()}
        onRefuse={vi.fn()}
        onUndo={vi.fn()}
        onRecordArrival={vi.fn()}
        onFinishCheckIn={vi.fn()}
        onCancelWithoutFee={vi.fn()}
        onRescheduleWithoutCharge={vi.fn()}
        isBusy={false}
      />
    </MemoryRouter>,
  );

describe('BookingCard vaccination certificate', () => {
  it('shows when the certificate came and links to it through the staff endpoint', () => {
    renderCard(
      booking({
        fully_vaccinated: true,
        has_vaccination_certificate: true,
        vaccination_document_uploaded_at: '2026-09-29T01:00:00.000Z',
      }),
    );

    expect(screen.getByText(/Uploaded 29 Sept? 2026/)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /View certificate/ });
    expect(link).toHaveAttribute(
      'href',
      expect.stringMatching(new RegExp(`/admin/vaccination-certificates/${BOOKING_PET_ID}$`)),
    );
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('says when no certificate is on file, with no link', () => {
    renderCard(booking({}));

    expect(
      screen.getByText(
        'Not uploaded yet. Without proof at drop-off, the pet is kept apart from other pets.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /View certificate/ })).not.toBeInTheDocument();
  });
});

describe('BookingCard decision maker', () => {
  const decided = (
    review: Pick<
      ManagerBookingRecord['booking'],
      'manager_review_status' | 'refusal_reason' | 'reviewer_name'
    >,
  ): ManagerBookingRecord => {
    const record = booking({});
    return { ...record, booking: { ...record.booking, ...review } };
  };

  it('names the manager who approved the stay', () => {
    renderCard(
      decided({
        manager_review_status: 'approved',
        refusal_reason: null,
        reviewer_name: 'Mere Walker',
      }),
    );

    expect(screen.getByText('Approved by Mere Walker')).toBeInTheDocument();
  });

  it('names the manager who refused, with the reason', () => {
    renderCard(
      decided({
        manager_review_status: 'refused',
        refusal_reason: 'Full that week.',
        reviewer_name: 'James Chen',
      }),
    );

    expect(screen.getByText(/Refused by James Chen:\s*Full that week\./)).toBeInTheDocument();
  });

  it('names nobody for a stay confirmed at checkout', () => {
    renderCard(
      decided({ manager_review_status: 'approved', refusal_reason: null, reviewer_name: null }),
    );

    expect(screen.queryByText(/Approved by/)).not.toBeInTheDocument();
  });
});

describe('BookingCard money line', () => {
  const withCard = (
    card: NonNullable<ManagerBookingRecord['booking']['card_guarantee']>,
  ): ManagerBookingRecord => {
    const record = booking({});
    return { ...record, booking: { ...record.booking, card_guarantee: card } };
  };

  it('says a pay-at-request stay is paid and that the desk refunds what is not owed', () => {
    renderCard(
      withCard({
        status: 'succeeded',
        amount: 460,
        captured_amount: null,
        test_mode: true,
        pays_at_request: true,
      }),
    );

    expect(
      screen.getByText('Paid: $460.00. Finishing check-in refunds what is not owed.'),
    ).toBeInTheDocument();
  });

  it('says a pay-at-request request is held while it is decided', () => {
    renderCard(
      withCard({
        status: 'authorized',
        amount: 230,
        captured_amount: null,
        test_mode: true,
        pays_at_request: true,
      }),
    );

    expect(screen.getByText(/^Held: \$230\.00 while the request is decided\./)).toBeInTheDocument();
  });

  it('says a full refund plainly', () => {
    renderCard(
      withCard({
        status: 'refunded',
        amount: 460,
        captured_amount: 0,
        test_mode: true,
        pays_at_request: true,
      }),
    );

    expect(screen.getByText('Refunded in full. Nothing was kept.')).toBeInTheDocument();
  });
});

describe('BookingCard amount owed at check-out', () => {
  it('shows what in-stay changes without a saved card cost, to take at the desk', () => {
    const record = booking({});
    renderCard({ ...record, booking: { ...record.booking, to_pay_at_check_out: 45 } });

    expect(screen.getByText(/^To pay at check-out: \$45\.00/)).toBeInTheDocument();
  });

  it('shows nothing when nothing is owed', () => {
    renderCard(booking({}));

    expect(screen.queryByText(/To pay at check-out/)).not.toBeInTheDocument();
  });
});

describe('BookingCard pet profile link', () => {
  const approved = (petId: string | null): ManagerBookingRecord => {
    const record = booking({});
    return {
      ...record,
      pet: { ...record.pet, id: petId },
      booking: { ...record.booking, manager_review_status: 'approved' },
    };
  };

  it("links an approved stay to the pet's profile", () => {
    renderCard(approved('pet-max'));

    expect(screen.getByRole('link', { name: 'View Profile' })).toHaveAttribute(
      'href',
      `/admin/pets/pet-max?bookingPetsUuid=${BOOKING_PET_ID}`,
    );
  });

  it('keeps the stay but offers no profile once the owner deleted it', () => {
    renderCard(approved(null));

    expect(screen.queryByRole('link', { name: 'View Profile' })).not.toBeInTheDocument();
    expect(screen.getByText('Profile deleted by the owner')).toBeInTheDocument();
  });
});

describe('BookingCard overdue request', () => {
  const renderAt = (now: Date, checkIn: string): void => {
    const record = booking({});
    const waiting = {
      ...record,
      booking: { ...record.booking, dates: { check_in: checkIn, check_out: '2026-10-09' } },
    };
    render(
      <MemoryRouter>
        <BookingCard
          booking={waiting}
          petsOfBooking={[waiting]}
          isFirstOfBooking
          now={now}
          onApprove={vi.fn()}
          onRefuse={vi.fn()}
          onUndo={vi.fn()}
          onRecordArrival={vi.fn()}
          onFinishCheckIn={vi.fn()}
          onCancelWithoutFee={vi.fn()}
          onRescheduleWithoutCharge={vi.fn()}
          isBusy={false}
        />
      </MemoryRouter>,
    );
  };

  it('counts the days in Auckland, where the drop-off date lives', () => {
    // 9am on 6 Oct in Auckland is still 5 Oct in UTC: yesterday's drop-off is already overdue.
    renderAt(new Date('2026-10-05T20:00:00Z'), '2026-10-05');
    expect(screen.getByText('OVERDUE')).toBeInTheDocument();
  });

  it('is not overdue on its own drop-off day', () => {
    renderAt(new Date('2026-10-05T20:00:00Z'), '2026-10-06');
    expect(screen.queryByText('OVERDUE')).not.toBeInTheDocument();
  });

  it('frames a request waiting for review 3 days or less before check-in', () => {
    const base = booking({});
    // renderCard uses 1 Oct 2026, so 3 Oct is two days away.
    renderCard({
      ...base,
      booking: { ...base.booking, dates: { check_in: '2026-10-03', check_out: '2026-10-05' } },
    });

    expect(screen.getByText('CHECK-IN IN 2 DAYS')).toBeInTheDocument();
  });

  it('does not frame a request with check-in further away', () => {
    renderCard(booking({}));

    expect(screen.queryByText(/CHECK-IN IN/)).not.toBeInTheDocument();
  });
});
