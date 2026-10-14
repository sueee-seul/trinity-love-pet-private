import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useConciergeStore } from '../../../concierge/store/conciergeStore';
import { fetchMyBookings } from '../../api/bookingApi';
import type { ChecklistItem, CurrentStay, HomeData, HomePet, UpcomingStay } from '../../types/home';
import type { PetStay } from '../../types/stays';
import { englishWordsIn } from '../../../../shared/i18n/testing/englishWordsIn';
import { HomeContent } from './HomeContent';

vi.mock('../../api/bookingApi', () => ({ fetchMyBookings: vi.fn() }));
// The stay under way has sent no update yet, so the hero shows no update line.
vi.mock('../../api/staySummariesApi', () => ({
  fetchStaySummaries: vi.fn(() => Promise.resolve([])),
}));

const max: HomePet = { id: 'pet-max', name: 'Max', species: 'dog', breed: 'Labrador', ageYears: 4 };
const luna: HomePet = { id: 'pet-luna', name: 'Luna', species: 'cat', ageYears: 2 };

const checklist: ChecklistItem[] = [
  { key: 'agreement', label: 'Agreement signed', status: 'done', tappable: false },
  { key: 'payment', label: 'Booking payment completed', status: 'done', tappable: false },
  {
    key: 'vaccination',
    label: 'Vaccination information',
    status: 'outstanding',
    tappable: true,
    bookingPetIds: ['bp-max'],
  },
  { key: 'admission', label: 'Admission verification', status: 'outstanding', tappable: false },
];

const upcomingStay: UpcomingStay = {
  bookingId: 'b1',
  confirmationNumber: 'PB-AAAAAA',
  status: 'waiting_for_review',
  dropOffAt: new Date(2026, 8, 12, 9).toISOString(),
  pickUpAt: new Date(2026, 8, 16, 9).toISOString(),
  nights: 4,
  daysToGo: 5,
  serviceType: 'Overnight boarding',
  pets: [{ bookingPetId: 'bp-max', petId: 'pet-max', name: 'Max' }],
  checklist,
};

const home = (overrides: Partial<HomeData>): HomeData => ({
  state: 'B1',
  owner: { firstName: 'Phuong' },
  pets: [max, luna],
  hasPastStays: false,
  upcomingStays: [],
  currentStays: [],
  needsAttention: [],
  getReady: [],
  ...overrides,
});

const currentStay: CurrentStay = {
  bookingId: 'b-now',
  confirmationNumber: 'PB-NOWNOW',
  dropOffAt: new Date(2026, 8, 5, 9).toISOString(),
  pickUpAt: new Date(2026, 8, 9, 16).toISOString(),
  nights: 4,
  serviceType: 'Boarding',
  pets: [
    { bookingPetId: 'bp-now-max', petId: 'pet-max', name: 'Max' },
    { bookingPetId: 'bp-now-luna', petId: 'pet-luna', name: 'Luna' },
  ],
  daysUntilPickUp: 2,
};

const petStay: PetStay = {
  bookingPetId: 'bp-max',
  bookingId: 'b1',
  confirmationNumber: 'PB-AAAAAA',
  createdAt: new Date(2026, 7, 1).toISOString(),
  pet: { id: 'pet-max', name: 'Max' },
  dropOffAt: upcomingStay.dropOffAt,
  pickUpAt: upcomingStay.pickUpAt,
  status: 'waiting_for_review',
  reviewStatus: 'pending',
  refusalReason: null,
  reviewerName: null,
  nights: 4,
  serviceType: 'Overnight boarding',
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
  total: 120,
  getReady: null,
  checkInOutcome: null,
  dateChangesLeft: null,
  card: null,
};

// C1/C2 prefetch bookings for the "View booking" modal on mount; default to an
// empty list so tests that don't care about the modal are unaffected. Tests
// that do care set their own `mockResolvedValue` before calling `renderHome`.
beforeEach(() => {
  vi.mocked(fetchMyBookings).mockReset().mockResolvedValue([]);
});

const renderHome = (data: HomeData): void => {
  render(
    <MemoryRouter>
      <HomeContent home={data} />
    </MemoryRouter>,
  );
};

const quickActionLabels = (): string[] =>
  within(screen.getByRole('region', { name: 'Quick actions' }))
    .getAllByRole('link')
    .map((link) => link.textContent ?? '');

describe('HomeContent', () => {
  it('state A: create your first pet, how it works, two quick actions, no Your pets', () => {
    renderHome(home({ state: 'A', pets: [] }));
    expect(screen.getByRole('heading', { level: 1, name: 'Welcome, Phuong' })).toBeInTheDocument();
    expect(screen.getByText("Let's get your pet ready for their first stay.")).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Create your first pet' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(4);
    expect(screen.getByText('Follow their care')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Your pets' })).not.toBeInTheDocument();
    expect(quickActionLabels()).toEqual(['Add your pet', 'Profile']);
    // Both "Add your pet" buttons open the pets tab; Profile opens the main page.
    const addYourPet = screen.getAllByRole('link', { name: 'Add your pet' });
    expect(addYourPet).toHaveLength(2);
    addYourPet.forEach((link) => expect(link).toHaveAttribute('href', '/parent/profile?tab=pets'));
    expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute(
      'href',
      '/parent/profile',
    );
  });

  it('state B1: book a stay for either pet', () => {
    renderHome(home({ state: 'B1' }));
    expect(screen.getByText("Ready to plan your pet's first stay?")).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Book a stay' })).toBeInTheDocument();
    expect(screen.getByText('Choose your dates and services for Max or Luna.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start a booking' })).toHaveAttribute(
      'href',
      '/parent/booking',
    );
    expect(screen.getByRole('heading', { name: 'Your pets' })).toBeInTheDocument();
    // The hero books the stay, so the grid offers other places instead of repeating it.
    expect(quickActionLabels()).toEqual(['My stays', 'My pets', 'Leave feedback', 'Profile']);
  });

  it('state B2: book another stay, with past bookings on every screen size', () => {
    renderHome(home({ state: 'B2', hasPastStays: true }));
    expect(screen.getByText("Ready for Max and Luna's next stay?")).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Book another stay' })).toBeInTheDocument();
    const pastBookings = screen.getByRole('link', { name: 'View past bookings' });
    expect(pastBookings).toHaveAttribute('href', '/parent/stays');
    expect(pastBookings).not.toHaveClass('hidden');
    expect(quickActionLabels()).toEqual(['My stays', 'My pets', 'Leave feedback', 'Profile']);
  });

  it('state C1: upcoming stay hero with the four-item checklist in order', () => {
    renderHome(home({ state: 'C1', upcomingStays: [upcomingStay] }));
    expect(
      screen.getByRole('heading', { level: 1, name: 'Welcome back, Phuong' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: "Max's stay is coming up" })).toBeInTheDocument();
    // A paid request is still waiting for the manager's review, never "Payment received".
    expect(screen.getByText('Waiting for review')).toBeInTheDocument();
    expect(screen.queryByText('Confirmed')).not.toBeInTheDocument();
    expect(screen.queryByText('Payment received')).not.toBeInTheDocument();
    expect(screen.getByText('5 days to go')).toBeInTheDocument();
    expect(
      screen.getByText('12 Sep to 16 Sep · 4 nights · Overnight boarding'),
    ).toBeInTheDocument();

    const items = within(screen.getByRole('region', { name: 'Before the stay' })).getAllByRole(
      'listitem',
    );
    expect(items.map((item) => item.textContent)).toEqual([
      'Agreement signed (done)',
      'Booking payment completed (done)',
      'Vaccination information (outstanding)',
      'Admission verification (outstanding)',
    ]);
    expect(quickActionLabels()).toEqual(['Prepare', 'My stays', 'Book a stay', 'Leave feedback']);
  });

  it('says "Confirmed" once the stay is confirmed', () => {
    renderHome(home({ state: 'C1', upcomingStays: [{ ...upcomingStay, status: 'approved' }] }));
    expect(screen.getByText('Confirmed')).toHaveClass(
      'bg-status-success/10',
      'text-status-success',
    );
    expect(screen.queryByText('Waiting for review')).not.toBeInTheDocument();
  });

  it('gives status chips a type role, so they never fall back to the body serif', () => {
    renderHome(home({ state: 'C1', upcomingStays: [upcomingStay] }));
    expect(screen.getByText('Waiting for review')).toHaveClass('type-meta');
  });

  it('writes the "Waiting for review" chip in the darker accent, which keeps 4.5:1 on its tint', () => {
    renderHome(home({ state: 'C1', upcomingStays: [upcomingStay] }));
    expect(screen.getByText('Waiting for review')).toHaveClass(
      'bg-surface-bubbles',
      'text-accent-foreground-hover',
    );
  });

  it('moves the status under the names on a phone, so three pets and a long issue fit at 375px', () => {
    const kiwi: HomePet = { id: 'pet-kiwi', name: 'Kiwi', species: 'dog', ageYears: 6 };
    const threePets: UpcomingStay = {
      ...upcomingStay,
      bookingId: 'b3',
      dropOffAt: new Date(2026, 9, 1, 9).toISOString(),
      pickUpAt: new Date(2026, 9, 3, 9).toISOString(),
      pets: [
        { bookingPetId: 'bp-max', petId: 'pet-max', name: 'Max' },
        { bookingPetId: 'bp-luna', petId: 'pet-luna', name: 'Luna' },
        { bookingPetId: 'bp-kiwi', petId: 'pet-kiwi', name: 'Kiwi' },
      ],
    };
    renderHome(
      home({ state: 'C1', pets: [max, luna, kiwi], upcomingStays: [upcomingStay, threePets] }),
    );

    const row = within(screen.getByRole('region', { name: 'Also coming up' })).getByRole('link', {
      name: /Max, Luna and Kiwi/,
    });
    const status = within(row).getByText('Incomplete vaccination');
    // Two columns and a full-width status line on a phone; a third column for it from `sm`.
    expect(row).toHaveClass('grid', 'grid-cols-[auto_minmax(0,1fr)]');
    expect(row).toHaveClass('sm:grid-cols-[auto_minmax(0,1fr)_auto]');
    expect(status).toHaveClass('col-span-2', 'sm:col-span-1');
  });

  it('nests "Before the stay" under the hero heading and titles each section', () => {
    renderHome(home({ state: 'C1', upcomingStays: [upcomingStay] }));
    expect(screen.getByRole('heading', { level: 3, name: 'Before the stay' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Your pets' })).toHaveClass(
      'type-card-title',
      'font-normal',
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Quick actions' })).toHaveClass(
      'type-card-title',
      'font-normal',
    );
  });

  it('only outstanding items with a page are tappable; Prepare opens the first one', () => {
    renderHome(home({ state: 'C1', upcomingStays: [upcomingStay] }));
    const list = within(screen.getByRole('region', { name: 'Before the stay' }));
    expect(list.getAllByRole('link')).toHaveLength(1);
    expect(list.getByRole('link', { name: /Vaccination information/ })).toHaveAttribute(
      'href',
      '/parent/vaccination/bp-max',
    );
    expect(screen.getByRole('link', { name: 'Prepare for stay' })).toHaveAttribute(
      'href',
      '/parent/vaccination/bp-max',
    );
    // The Quick actions cell navigates to My Stays; the hero's own secondary
    // button opens the booking-details modal instead (see below).
    expect(screen.getByRole('link', { name: 'My stays' })).toHaveAttribute('href', '/parent/stays');
    expect(screen.getByRole('button', { name: 'View booking' })).toBeInTheDocument();
  });

  it('opens the shared booking-details modal, for the hero’s first pet, when "View booking" is clicked', async () => {
    vi.mocked(fetchMyBookings).mockResolvedValue([petStay]);
    renderHome(home({ state: 'C1', upcomingStays: [upcomingStay] }));

    fireEvent.click(screen.getByRole('button', { name: 'View booking' }));

    expect(await screen.findByRole('heading', { name: 'Booking details' })).toBeInTheDocument();
    expect(screen.getByText('PB-AAAAAA')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('heading', { name: 'Booking details' })).not.toBeInTheDocument();
  });

  it('offers the boarding pass on the hero once the manager approved the stay', async () => {
    vi.mocked(fetchMyBookings).mockResolvedValue([
      { ...petStay, status: 'approved', reviewStatus: 'approved' },
    ]);
    renderHome(home({ state: 'C1', upcomingStays: [{ ...upcomingStay, status: 'approved' }] }));

    expect(screen.queryByRole('button', { name: 'View booking' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View boarding pass' }));

    const dialog = await screen.findByRole('dialog', { name: 'Booking details' });
    const pass = within(dialog).getByRole('region', { name: 'Boarding pass' });
    expect(within(pass).getByText('PB-AAAAAA')).toBeInTheDocument();
    expect(within(pass).getByText('Confirmed')).toBeInTheDocument();
  });

  it('offers no boarding pass while the request waits for review', async () => {
    vi.mocked(fetchMyBookings).mockResolvedValue([petStay]);
    renderHome(home({ state: 'C1', upcomingStays: [upcomingStay] }));

    expect(screen.queryByRole('button', { name: 'View boarding pass' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View booking' }));

    const dialog = await screen.findByRole('dialog', { name: 'Booking details' });
    expect(within(dialog).getByText('Waiting for review')).toBeInTheDocument();
    expect(within(dialog).queryByRole('region', { name: 'Boarding pass' })).not.toBeInTheDocument();
  });

  it('does not prefetch bookings for states with nothing to view', () => {
    renderHome(home({ state: 'B1' }));
    expect(fetchMyBookings).not.toHaveBeenCalled();
  });

  it('opens the modal for the first pet on a multi-pet booking', async () => {
    const lunaStay: PetStay = {
      ...petStay,
      bookingPetId: 'bp-luna',
      confirmationNumber: 'PB-LUNAAA',
      pet: { id: 'pet-luna', name: 'Luna' },
    };
    vi.mocked(fetchMyBookings).mockResolvedValue([lunaStay, petStay]);
    renderHome(
      home({
        state: 'C1',
        upcomingStays: [
          {
            ...upcomingStay,
            pets: [
              ...upcomingStay.pets,
              { bookingPetId: 'bp-luna', petId: 'pet-luna', name: 'Luna' },
            ],
          },
        ],
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'View booking' }));

    // Max is pets[0] on the booking, so his stay (not Luna's) is what opens.
    expect(await screen.findByText('PB-AAAAAA')).toBeInTheDocument();
    expect(screen.queryByText('PB-LUNAAA')).not.toBeInTheDocument();
  });

  it('state C2: same hero as C1', () => {
    renderHome(
      home({
        state: 'C2',
        hasPastStays: true,
        upcomingStays: [upcomingStay],
      }),
    );
    expect(screen.getByRole('heading', { name: "Max's stay is coming up" })).toBeInTheDocument();
    expect(quickActionLabels()).toEqual(['Prepare', 'My stays', 'Book a stay', 'Leave feedback']);
  });

  it('names every pet on a multi-pet booking', () => {
    renderHome(
      home({
        state: 'C1',
        upcomingStays: [
          {
            ...upcomingStay,
            pets: [
              ...upcomingStay.pets,
              { bookingPetId: 'bp-luna', petId: 'pet-luna', name: 'Luna' },
            ],
          },
        ],
      }),
    );
    expect(
      screen.getByRole('heading', { name: "Max and Luna's stay is coming up" }),
    ).toBeInTheDocument();
  });

  it('only the soonest booking becomes the hero; the rest are compact rows below it', () => {
    const doneChecklist: ChecklistItem[] = [
      { key: 'agreement', label: 'Agreement signed', status: 'done', tappable: false },
      { key: 'payment', label: 'Booking payment completed', status: 'done', tappable: false },
      { key: 'vaccination', label: 'Vaccination information', status: 'done', tappable: false },
      { key: 'admission', label: 'Admission verification', status: 'outstanding', tappable: false },
    ];
    const second: UpcomingStay = {
      ...upcomingStay,
      status: 'approved',
      bookingId: 'b2',
      confirmationNumber: 'PB-BBBBBB',
      pets: [{ bookingPetId: 'bp-luna', petId: 'pet-luna', name: 'Luna' }],
      dropOffAt: new Date(2026, 9, 1, 9).toISOString(),
      pickUpAt: new Date(2026, 9, 3, 9).toISOString(),
      daysToGo: 16,
      checklist: doneChecklist,
    };
    renderHome(home({ state: 'C2', upcomingStays: [upcomingStay, second] }));

    // Only the soonest booking (Max) gets the full hero treatment.
    expect(screen.getByRole('heading', { name: "Max's stay is coming up" })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: "Luna's stay is coming up" }),
    ).not.toBeInTheDocument();

    // Luna's booking shows as a compact "Also coming up" row instead, admission
    // excluded from the count since it has nowhere for the parent to act on it.
    const alsoComingUp = within(screen.getByRole('region', { name: 'Also coming up' }));
    expect(alsoComingUp.getByText('1 to 3 Oct · 16 days')).toBeInTheDocument();
    expect(alsoComingUp.getByText('All set')).toBeInTheDocument();
    expect(alsoComingUp.getByRole('link', { name: /Luna/ })).toHaveAttribute(
      'href',
      '/parent/stays',
    );
  });

  it('names the specific preparation issue on the compact row, not a generic count', () => {
    const second: UpcomingStay = {
      ...upcomingStay,
      bookingId: 'b2',
      pets: [{ bookingPetId: 'bp-luna', petId: 'pet-luna', name: 'Luna' }],
      dropOffAt: new Date(2026, 9, 1, 9).toISOString(),
      pickUpAt: new Date(2026, 9, 3, 9).toISOString(),
      checklist: [
        ...checklist.filter((item) => item.key !== 'vaccination'),
        {
          key: 'vaccination',
          label: 'Vaccination information',
          status: 'outstanding',
          tappable: true,
          bookingPetIds: ['bp-luna'],
        },
      ],
    };
    renderHome(home({ state: 'C1', upcomingStays: [upcomingStay, second] }));
    const alsoComingUp = within(screen.getByRole('region', { name: 'Also coming up' }));
    expect(alsoComingUp.getByText('Incomplete vaccination')).toBeInTheDocument();
    expect(alsoComingUp.getByRole('link', { name: /Luna/ })).toHaveAttribute(
      'href',
      '/parent/vaccination/bp-luna',
    );
  });

  it('caps "Also coming up" at two rows and links to My Stays for the rest', () => {
    const bookingAfterHero = (n: number): UpcomingStay => ({
      ...upcomingStay,
      bookingId: `b${n}`,
      pets: [{ bookingPetId: `bp-pet${n}`, petId: `pet-${n}`, name: `Pet ${n}` }],
    });
    renderHome(
      home({
        state: 'C1',
        upcomingStays: [
          upcomingStay,
          bookingAfterHero(2),
          bookingAfterHero(3),
          bookingAfterHero(4),
        ],
      }),
    );
    expect(screen.getByRole('link', { name: /Pet 2/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Pet 3/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Pet 4/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View all upcoming stays (4)' })).toHaveAttribute(
      'href',
      '/parent/stays',
    );
  });

  it('hides the overflow link when there are two or fewer additional bookings', () => {
    const second: UpcomingStay = { ...upcomingStay, bookingId: 'b2' };
    renderHome(home({ state: 'C1', upcomingStays: [upcomingStay, second] }));
    expect(screen.queryByText(/View all upcoming stays/)).not.toBeInTheDocument();
  });

  it('pet links open the pets tab, Profile the profile page and Leave feedback the feedback page', () => {
    renderHome(home({ state: 'B1' }));
    const petsTab = '/parent/profile?tab=pets';
    expect(screen.getByRole('link', { name: 'My pets' })).toHaveAttribute('href', petsTab);
    // Your pets renders both a mobile tile and a desktop row, each labelled "Add a pet".
    screen
      .getAllByRole('link', { name: 'Add a pet' })
      .forEach((link) => expect(link).toHaveAttribute('href', petsTab));
    expect(screen.getByRole('link', { name: 'See all' })).toHaveAttribute('href', petsTab);
    expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute(
      'href',
      '/parent/profile',
    );
    expect(screen.getByRole('link', { name: 'Leave feedback' })).toHaveAttribute(
      'href',
      '/parent/feedback',
    );
  });

  it('a stay under way leads the page and links to Live Care, even with no booking history', () => {
    renderHome(home({ state: 'B1', currentStays: [currentStay] }));
    expect(screen.queryByText("Ready to plan your pet's first stay?")).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Book a stay' })).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Max and Luna are staying with us' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Check-out in 2 days')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: "See today's updates" })).toHaveAttribute(
      'href',
      '/parent/live-care/bp-now-max',
    );
    expect(quickActionLabels()).toEqual([
      "Today's updates",
      'My stays',
      'Book a stay',
      'Leave feedback',
    ]);
  });

  it('shows every stay under way, one card each, when two bookings overlap', () => {
    const secondStay: CurrentStay = {
      ...currentStay,
      bookingId: 'b-now-2',
      confirmationNumber: 'PB-SECOND',
      pets: [{ bookingPetId: 'bp-now-pepper', petId: 'pet-pepper', name: 'Pepper' }],
    };
    renderHome(home({ state: 'C2', currentStays: [currentStay, secondStay] }));
    expect(
      screen.getByRole('heading', { name: 'Max and Luna are staying with us' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pepper is staying with us' })).toBeInTheDocument();
    expect(
      screen
        .getAllByRole('link', { name: "See today's updates" })
        .map((link) => link.getAttribute('href')),
    ).toEqual(['/parent/live-care/bp-now-max', '/parent/live-care/bp-now-pepper']);
  });

  // The side column's grid cell that holds a section.
  const sideCell = (name: string): HTMLElement =>
    screen.getByRole('region', { name }).closest('[class*="lg:col-start-2"]') as HTMLElement;

  it('moves Quick actions under Your pets when nothing else follows the stays', () => {
    renderHome(home({ state: 'C2', currentStays: [currentStay] }));
    const petsColumn = sideCell('Your pets');
    expect(petsColumn).toContainElement(screen.getByRole('region', { name: 'Quick actions' }));
    expect(petsColumn).not.toContainElement(
      screen.getByRole('heading', { name: 'Max and Luna are staying with us' }),
    );
  });

  it('keeps Quick actions beside the upcoming bookings when there are some', () => {
    renderHome(home({ state: 'C2', currentStays: [currentStay], upcomingStays: [upcomingStay] }));
    const petsColumn = sideCell('Your pets');
    expect(petsColumn).not.toContainElement(screen.getByRole('region', { name: 'Quick actions' }));
  });

  it('while a stay is under way, every upcoming booking is a compact row', () => {
    renderHome(home({ state: 'C2', currentStays: [currentStay], upcomingStays: [upcomingStay] }));
    expect(
      screen.queryByRole('heading', { name: "Max's stay is coming up" }),
    ).not.toBeInTheDocument();
    const rows = within(screen.getByRole('region', { name: 'Also coming up' })).getAllByRole(
      'link',
    );
    expect(rows).toHaveLength(1);
  });

  it('lists each pet with breed/species and age', () => {
    renderHome(home({ state: 'B1' }));
    expect(screen.getAllByText('Labrador · 4 yrs').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Cat · 2 yrs').length).toBeGreaterThan(0);
  });
});

describe('HomeContent in Chinese', () => {
  afterEach(() => {
    act(() => useConciergeStore.getState().setLocale('en'));
  });

  it('state A: writes the greeting, the first-pet hero and the steps in Chinese', () => {
    useConciergeStore.getState().setLocale('zh');
    renderHome(home({ state: 'A', pets: [] }));

    expect(screen.getByRole('heading', { level: 1, name: '欢迎，Phuong' })).toBeInTheDocument();
    expect(screen.getByText('一起为毛孩子的第一次住宿做好准备吧。')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '添加你的第一只宠物' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '使用流程' })).toBeInTheDocument();
    expect(screen.getByText('创建宠物档案')).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: '快捷操作' }))
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['添加宠物', '个人资料']);
  });

  it('state C1: writes the hero, the checklist and the side column in Chinese, then English again', () => {
    useConciergeStore.getState().setLocale('zh');
    renderHome(home({ state: 'C1', upcomingStays: [upcomingStay] }));

    expect(screen.getByRole('heading', { level: 1, name: '欢迎回来，Phuong' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Max 的住宿快到了' })).toBeInTheDocument();
    expect(screen.getByText('还有 5 天')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '住宿之前' })).toBeInTheDocument();
    // The checklist row names the item in Chinese, not in the server's English.
    expect(screen.getByRole('link', { name: '疫苗信息（未完成）' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '为住宿做准备' })).toHaveAttribute(
      'href',
      '/parent/vaccination/bp-max',
    );
    expect(screen.getByRole('button', { name: '查看预约' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '你的宠物' })).toBeInTheDocument();
    expect(screen.getAllByText('拉布拉多 · 4 岁').length).toBeGreaterThan(0);
    expect(screen.getAllByText('猫咪 · 2 岁').length).toBeGreaterThan(0);
    expect(
      within(screen.getByRole('region', { name: '快捷操作' }))
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['住前准备', '我的住宿', '预订住宿', '留下反馈']);

    expect(englishWordsIn(document.body, ['Phuong', 'Max', 'Luna', 'Labrador', 'PB'])).toEqual([]);

    act(() => useConciergeStore.getState().setLocale('en'));

    expect(screen.getByRole('heading', { name: "Max's stay is coming up" })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Prepare for stay' })).toBeInTheDocument();
    expect(quickActionLabels()).toEqual(['Prepare', 'My stays', 'Book a stay', 'Leave feedback']);
  });

  it('a stay under way: names the pets and the check-out in Chinese', () => {
    useConciergeStore.getState().setLocale('zh');
    renderHome(home({ state: 'C2', currentStays: [currentStay] }));

    expect(screen.getByRole('heading', { name: 'Max 和 Luna 正住在我们这里' })).toBeInTheDocument();
    expect(screen.getByText('2 天后离店')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '查看今日动态' })).toBeInTheDocument();
  });
});
