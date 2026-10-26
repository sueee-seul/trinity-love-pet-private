import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { MyStaysPage } from '../MyStaysPage';
import { fetchMyBookings } from '../../api/bookingApi';
import type { ManagerReviewStatus, StayStatus, PetStay } from '../../types/stays';

vi.mock('../../api/bookingApi', () => ({ fetchMyBookings: vi.fn() }));
// The change-request list reads its own data; these tests are about the stays.
vi.mock('../../api/stayChangesApi', () => ({ fetchStayChangeRequests: vi.fn(async () => []) }));

const DAY_MS = 24 * 60 * 60 * 1000;
const daysFromNow = (days: number): string => new Date(Date.now() + days * DAY_MS).toISOString();

// The server sends the status; each fixture states the one it would send for its dates.
const REVIEW_STATUS: Record<StayStatus, ManagerReviewStatus> = {
  waiting_for_review: 'pending',
  approved: 'approved',
  staying_now: 'approved',
  stay_ended: 'approved',
  did_not_arrive: 'approved',
  refused: 'refused',
  cancelled: 'cancelled',
};

const stay = (
  bookingPetId: string,
  petName: string,
  from: number,
  to: number,
  status: StayStatus,
  refusalReason: string | null = null,
): PetStay => ({
  bookingPetId,
  bookingId: `b-${bookingPetId}`,
  confirmationNumber: 'PB-7K2Q9M',
  createdAt: daysFromNow(-30),
  pet: { id: `pet-${petName.toLowerCase()}`, name: petName },
  dropOffAt: daysFromNow(from),
  pickUpAt: daysFromNow(to),
  status,
  reviewStatus: REVIEW_STATUS[status],
  refusalReason,
  reviewerName: null,
  nights: to - from,
  serviceType: 'Boarding',
  services: [{ id: 'svc-walk', name: 'Extra walk', quantity: 2, total: 30 }],
  caringInfo: {
    feedingRoutine: 'Twice a day',
    medInstruction: '',
    firstTimeBoarding: true,
    crateTrained: null,
    socialAllow: true,
    fullyVaccinated: true,
    behaveNHealth: '',
    others: '',
  },
  total: 240,
  getReady: null,
  // Booked before the card guarantee: nothing to cancel or move online.
  checkInOutcome: null,
  dateChangesLeft: null,
  card: null,
});

const upcomingMax = stay('bp-max', 'Max', 5, 9, 'approved');
const stayingBiscuit = stay('bp-biscuit', 'Biscuit', -1, 3, 'staying_now');
const pastLuna = stay('bp-luna', 'Luna', -20, -16, 'stay_ended');
const pendingRex = stay('bp-rex', 'Rex', 6, 8, 'waiting_for_review');
const refusedPepper = stay('bp-pepper', 'Pepper', 10, 12, 'refused', 'We are full that week.');
const oldRefusedKiwi = stay('bp-kiwi', 'Kiwi', -40, -38, 'refused', 'Full.');
const cancelledBo = stay('bp-bo', 'Bo', 14, 16, 'cancelled');

const renderPage = (
  props: Parameters<typeof MyStaysPage>[0] = {
    stays: [upcomingMax, stayingBiscuit, pastLuna],
  },
): ReturnType<typeof render> =>
  render(
    <MemoryRouter>
      <MyStaysPage {...props} />
    </MemoryRouter>,
  );

afterEach(() => {
  vi.clearAllMocks();
});

describe('MyStaysPage', () => {
  it('has one page title and counts upcoming stays in the Upcoming tab only', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'My stays' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('tab', { name: 'Upcoming (2)' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Past' })).toHaveAttribute('aria-selected', 'false');
  });

  it('lists the stay under way first, with its live status in words', () => {
    renderPage();

    const cards = within(screen.getByRole('tabpanel')).getAllByRole('article');
    expect(cards).toHaveLength(2);
    const [first, second] = cards;
    if (!first || !second) throw new Error('expected two stay cards');
    expect(within(first).getByRole('heading', { name: 'Biscuit' })).toBeInTheDocument();
    expect(within(first).getByText('Staying now')).toBeInTheDocument();
    expect(within(second).getByText('Confirmed')).toBeInTheDocument();
  });

  it('opens live care for a stay under way and explains when it opens for one not started', async () => {
    const user = userEvent.setup();
    const onViewCare = vi.fn();
    renderPage({ stays: [upcomingMax, stayingBiscuit], onViewCare });

    const biscuitCard = screen.getByRole('article', { name: 'Biscuit' });
    await user.click(within(biscuitCard).getByRole('button', { name: 'View live care' }));
    expect(onViewCare).toHaveBeenCalledWith('bp-biscuit');

    const maxCard = screen.getByRole('article', { name: 'Max' });
    expect(
      within(maxCard).queryByRole('button', { name: 'View live care' }),
    ).not.toBeInTheDocument();
    expect(
      within(maxCard).getByText('Live care opens when Max arrives for the stay.'),
    ).toBeInTheDocument();
  });

  it('names each manager decision in words and keeps future answers in Upcoming', async () => {
    const user = userEvent.setup();
    renderPage({ stays: [pendingRex, refusedPepper, cancelledBo, oldRefusedKiwi, pastLuna] });

    expect(screen.getByRole('tab', { name: 'Upcoming (3)' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('article', { name: 'Rex' })).getByText('Waiting for review'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('article', { name: 'Pepper' })).getByText('Not accepted'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('article', { name: 'Bo' })).getByText('Cancelled'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Past' }));
    const pastPanel = within(screen.getByRole('tabpanel', { name: 'Past' }));
    expect(pastPanel.getByRole('article', { name: 'Kiwi' })).toBeInTheDocument();
    expect(pastPanel.getByRole('article', { name: 'Luna' })).toBeInTheDocument();
  });

  it("shows the manager's reason on a refused request and offers no live care", () => {
    renderPage({ stays: [refusedPepper] });

    const card = screen.getByRole('article', { name: 'Pepper' });
    expect(within(card).getByText('Our manager said: We are full that week.')).toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: 'View live care' })).not.toBeInTheDocument();
    expect(within(card).queryByText(/Live care opens/)).not.toBeInTheDocument();
  });

  it('hides live care for a pending request, even once its dates have come', () => {
    const pendingNow = stay('bp-sam', 'Sam', -1, 2, 'waiting_for_review');
    renderPage({ stays: [pendingRex, pendingNow] });

    for (const name of ['Rex', 'Sam']) {
      const card = screen.getByRole('article', { name });
      expect(
        within(card).queryByRole('button', { name: 'View live care' }),
      ).not.toBeInTheDocument();
      expect(
        within(card).getByText(
          `Live care opens once our manager approves the stay and ${name} arrives.`,
        ),
      ).toBeInTheDocument();
    }
  });

  it('moves a request whose dates passed while it waited for review to Past', async () => {
    const user = userEvent.setup();
    const lapsedMilo = stay('bp-milo', 'Milo', -9, -7, 'waiting_for_review');
    renderPage({ stays: [pendingRex, lapsedMilo] });

    expect(screen.getByRole('tab', { name: 'Upcoming (1)' })).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'Milo' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Past' }));
    const card = within(screen.getByRole('tabpanel', { name: 'Past' })).getByRole('article', {
      name: 'Milo',
    });
    expect(within(card).getByText('Waiting for review')).toBeInTheDocument();
    expect(within(card).queryByText(/Live care opens/)).not.toBeInTheDocument();
  });

  it('opens live care for an approved stay that has ended', async () => {
    const user = userEvent.setup();
    const onViewCare = vi.fn();
    renderPage({ stays: [pastLuna], onViewCare });

    await user.click(screen.getByRole('tab', { name: 'Past' }));
    await user.click(screen.getByRole('button', { name: 'View live care' }));
    expect(onViewCare).toHaveBeenCalledWith('bp-luna');
  });

  it('moves between tabs with the arrow keys', async () => {
    const user = userEvent.setup();
    renderPage();

    const upcomingTab = screen.getByRole('tab', { name: 'Upcoming (2)' });
    upcomingTab.focus();
    await user.keyboard('{ArrowRight}');

    const pastTab = screen.getByRole('tab', { name: 'Past' });
    expect(pastTab).toHaveFocus();
    expect(pastTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Past' })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Luna' })).toBeInTheDocument();
    expect(screen.getByText('Stay ended')).toBeInTheDocument();
  });

  it('jumps to the last tab with End and back to the first with Home', async () => {
    const user = userEvent.setup();
    renderPage();

    screen.getByRole('tab', { name: 'Upcoming (2)' }).focus();
    await user.keyboard('{End}');

    const pastTab = screen.getByRole('tab', { name: 'Past' });
    expect(pastTab).toHaveFocus();
    expect(pastTab).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{Home}');

    const upcomingTab = screen.getByRole('tab', { name: 'Upcoming (2)' });
    expect(upcomingTab).toHaveFocus();
    expect(upcomingTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Upcoming (2)' })).toBeInTheDocument();
  });

  it('offers a booking when there is nothing upcoming', () => {
    renderPage({ stays: [pastLuna] });

    expect(screen.getByRole('tab', { name: 'Upcoming (0)' })).toBeInTheDocument();
    expect(screen.getByText('You have no upcoming stays yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Book a stay' })).toHaveAttribute(
      'href',
      '/parent/booking',
    );
  });

  it('shows the booking details in a dialog that carries the customer type scale', async () => {
    const user = userEvent.setup();
    renderPage();

    const biscuitCard = screen.getByRole('article', { name: 'Biscuit' });
    await user.click(within(biscuitCard).getByRole('button', { name: 'Booking details' }));

    const dialog = screen.getByRole('dialog', { name: 'Booking details' });
    // The shared Modal renders into <body>, outside the portal's own type scale wrapper.
    expect(dialog.closest('.parent-type-scale')).not.toBeNull();
    expect(within(dialog).getByText('PB-7K2Q9M')).toBeInTheDocument();
    expect(within(dialog).getByText('Staying now')).toBeInTheDocument();
    expect(within(dialog).getByText('Extra walk × 2')).toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { name: 'Care information' })).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog', { name: 'Booking details' })).not.toBeInTheDocument();
  });

  it.each([
    ['Max', upcomingMax, 'Confirmed'],
    ['Luna', pastLuna, 'Stay ended'],
  ] as const)(
    'leads the booking details of an approved stay (%s) with its boarding pass',
    async (name, approvedStay, statusLabel) => {
      const user = userEvent.setup();
      renderPage({ stays: [approvedStay] });

      if (approvedStay === pastLuna) await user.click(screen.getByRole('tab', { name: 'Past' }));
      await user.click(screen.getByRole('button', { name: 'Booking details' }));

      const dialog = screen.getByRole('dialog', { name: 'Booking details' });
      const pass = within(dialog).getByRole('region', { name: 'Boarding pass' });
      expect(within(pass).getByText('PB-7K2Q9M')).toBeInTheDocument();
      expect(within(pass).getByText(statusLabel)).toBeInTheDocument();
      expect(within(pass).getByText(name)).toBeInTheDocument();
      expect(within(pass).getByText(/· 4 nights$/)).toBeInTheDocument();
      expect(within(pass).getByText('Check-in')).toBeInTheDocument();
      expect(within(pass).getByText('Check-out')).toBeInTheDocument();
      expect(within(pass).getByText('Extra walk × 2')).toBeInTheDocument();
      expect(within(pass).getByText('$30.00')).toBeInTheDocument();
      expect(within(pass).getByText('$240.00')).toBeInTheDocument();
    },
  );

  it.each([
    ['Rex', pendingRex, 'Waiting for review'],
    ['Pepper', refusedPepper, 'Not accepted'],
    ['Bo', cancelledBo, 'Cancelled'],
  ] as const)(
    'shows no boarding pass for a request that is not approved (%s)',
    async (_name, request, statusLabel) => {
      const user = userEvent.setup();
      renderPage({ stays: [request] });

      await user.click(screen.getByRole('button', { name: 'Booking details' }));

      const dialog = screen.getByRole('dialog', { name: 'Booking details' });
      expect(
        within(dialog).queryByRole('region', { name: 'Boarding pass' }),
      ).not.toBeInTheDocument();
      expect(within(dialog).queryByText('Boarding pass')).not.toBeInTheDocument();
      expect(within(dialog).getByText(statusLabel)).toBeInTheDocument();
      expect(within(dialog).getByText('Requested on')).toBeInTheDocument();
      expect(within(dialog).queryByText('Booked on')).not.toBeInTheDocument();
      expect(within(dialog).getByText('Reference')).toBeInTheDocument();
      expect(within(dialog).queryByText('Confirmation number')).not.toBeInTheDocument();
    },
  );

  it('shows the status and the reason of a refused request in the booking details', async () => {
    const user = userEvent.setup();
    renderPage({ stays: [refusedPepper] });

    await user.click(screen.getByRole('button', { name: 'Booking details' }));

    const dialog = screen.getByRole('dialog', { name: 'Booking details' });
    expect(within(dialog).getByText('Not accepted')).toBeInTheDocument();
    expect(within(dialog).getByText('Our manager said')).toBeInTheDocument();
    expect(within(dialog).getByText('We are full that week.')).toBeInTheDocument();
  });

  it('loads the stays itself and offers a retry when that fails', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchMyBookings)
      .mockRejectedValueOnce(new Error('Network down'))
      .mockResolvedValueOnce([stayingBiscuit]);
    renderPage({});

    // A network failure carries no words for a parent, so the page writes its own.
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load your stays.');
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('article', { name: 'Biscuit' })).toBeInTheDocument();
  });
});
