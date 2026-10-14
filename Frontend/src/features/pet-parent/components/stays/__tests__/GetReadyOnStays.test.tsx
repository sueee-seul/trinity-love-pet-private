import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { MyStaysPage } from '../../../pages/MyStaysPage';
import type { GetReadyTask } from '../../../types/getReady';
import type { PetStay } from '../../../types/stays';

vi.mock('../../../api/bookingApi', () => ({ fetchMyBookings: vi.fn() }));

const DAY_MS = 24 * 60 * 60 * 1000;
const daysFromNow = (days: number): string => new Date(Date.now() + days * DAY_MS).toISOString();

const TASKS: GetReadyTask[] = [
  { key: 'vaccination', status: 'not_started' },
  { key: 'feeding', status: 'completed' },
  { key: 'medication', status: 'completed' },
  { key: 'emergency_contact_and_vet', status: 'not_started' },
];

const stay = (overrides: Partial<PetStay>): PetStay => ({
  bookingPetId: 'bp-max',
  bookingId: 'b-max',
  confirmationNumber: 'PB-7K2Q9M',
  createdAt: daysFromNow(-10),
  pet: { id: 'pet-max', name: 'Max' },
  dropOffAt: daysFromNow(5),
  pickUpAt: daysFromNow(9),
  status: 'approved',
  reviewStatus: 'approved',
  refusalReason: null,
  reviewerName: null,
  nights: 4,
  serviceType: 'Boarding',
  services: [],
  caringInfo: {
    feedingRoutine: '',
    medInstruction: '',
    firstTimeBoarding: null,
    crateTrained: null,
    socialAllow: null,
    fullyVaccinated: null,
    behaveNHealth: '',
    others: '',
  },
  total: 240,
  getReady: TASKS,
  checkInOutcome: null,
  dateChangesLeft: null,
  card: null,
  ...overrides,
});

// The server sends no list for a request that is not approved; the page must not invent one.
const pendingRex = stay({
  bookingPetId: 'bp-rex',
  pet: { id: 'pet-rex', name: 'Rex' },
  status: 'waiting_for_review',
  reviewStatus: 'pending',
  getReady: null,
});

const renderPage = (stays: PetStay[]): void => {
  render(
    <MemoryRouter>
      <MyStaysPage stays={stays} />
    </MemoryRouter>,
  );
};

describe('Get ready on My stays', () => {
  it('shows the count on an approved stay card and opens its tasks there', async () => {
    const user = userEvent.setup();
    renderPage([stay({})]);

    const card = screen.getByRole('article', { name: 'Max' });
    await user.click(within(card).getByText('Get ready, 2 of 4 done'));

    const vaccination = within(card).getByRole('link', { name: 'Vaccination proof' });
    expect(vaccination).toHaveAttribute('href', '/parent/vaccination/bp-max');
    expect(vaccination).toHaveAccessibleDescription(
      'A certificate that shows the date given and the next due date. Not started',
    );
    expect(within(card).getByRole('link', { name: 'Feeding' })).toHaveAccessibleDescription(
      'What Max eats, how much and when. Completed',
    );
    expect(within(card).getByRole('link', { name: 'Emergency contact and vet' })).toHaveAttribute(
      'href',
      '/parent/pets/pet-max',
    );
  });

  it("shows open medication as our team's job, with no link the parent cannot use", async () => {
    const user = userEvent.setup();
    const medicationOpen = TASKS.map((task) =>
      task.key === 'medication' ? { ...task, status: 'not_started' as const } : task,
    );
    renderPage([stay({ getReady: medicationOpen })]);

    const card = screen.getByRole('article', { name: 'Max' });
    await user.click(within(card).getByText('Get ready, 1 of 4 done'));

    expect(within(card).queryByRole('link', { name: 'Medication' })).not.toBeInTheDocument();
    expect(within(card).getByText('Medication')).toBeInTheDocument();
    expect(
      within(card).getByText(
        "Our team will go through Max's medicines, doses and times with you by check-in.",
      ),
    ).toBeInTheDocument();
  });

  it('shows no list on a request the manager has not approved', () => {
    renderPage([pendingRex]);

    const card = screen.getByRole('article', { name: 'Rex' });
    expect(within(card).queryByText(/Get ready/)).not.toBeInTheDocument();
  });

  it('lists the tasks in the booking details, with what happens at check-in', async () => {
    const user = userEvent.setup();
    renderPage([stay({})]);

    await user.click(screen.getByRole('button', { name: 'Booking details' }));

    const dialog = screen.getByRole('dialog', { name: 'Booking details' });
    const section = within(dialog).getByRole('region', { name: 'Get ready for check-in' });
    expect(within(section).getByText('2 of 4 done')).toBeInTheDocument();
    expect(within(section).getAllByRole('link')).toHaveLength(4);
    expect(
      within(section).getByText(
        "Our staff check Max's vaccination proof and give Max a health check.",
      ),
    ).toBeInTheDocument();
    expect(
      within(section).getByText(
        'Our team checks your recorded emergency vet consent. Current online bookings include consent up to NZ$500; older bookings may need a signature.',
      ),
    ).toBeInTheDocument();
  });

  it('leaves the tasks out of the booking details of a pending request', async () => {
    const user = userEvent.setup();
    renderPage([pendingRex]);

    await user.click(screen.getByRole('button', { name: 'Booking details' }));

    const dialog = screen.getByRole('dialog', { name: 'Booking details' });
    expect(
      within(dialog).queryByRole('region', { name: 'Get ready for check-in' }),
    ).not.toBeInTheDocument();
  });
});
