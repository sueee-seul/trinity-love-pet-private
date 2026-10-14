import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useConciergeStore } from '../../../concierge/store/conciergeStore';
import { fetchMyBookings } from '../../api/bookingApi';
import type { HomeData, RefusedRequest, UpcomingStay } from '../../types/home';
import { HomeContent } from './HomeContent';

vi.mock('../../api/bookingApi', () => ({ fetchMyBookings: vi.fn() }));

const refusedMax: RefusedRequest = {
  bookingPetId: 'bp-max',
  bookingId: 'b-refused',
  petName: 'Max',
  dropOffAt: new Date(2026, 9, 12, 9).toISOString(),
  pickUpAt: new Date(2026, 9, 16, 9).toISOString(),
  refusalReason: 'We are full that week.',
  reviewerName: null,
};

const allDone: UpcomingStay['checklist'] = [
  { key: 'agreement', label: 'Agreement signed', status: 'done', tappable: false },
  { key: 'payment', label: 'Booking payment completed', status: 'done', tappable: false },
  { key: 'vaccination', label: 'Vaccination information', status: 'done', tappable: false },
  { key: 'admission', label: 'Admission verification', status: 'outstanding', tappable: false },
];

const upcoming = (
  bookingId: string,
  petName: string,
  status: UpcomingStay['status'],
): UpcomingStay => ({
  bookingId,
  confirmationNumber: 'PB-AAAAAA',
  status,
  dropOffAt: new Date(2026, 9, 1, 9).toISOString(),
  pickUpAt: new Date(2026, 9, 3, 9).toISOString(),
  nights: 2,
  daysToGo: 5,
  serviceType: 'Boarding',
  pets: [{ bookingPetId: `bp-${bookingId}`, petId: `pet-${bookingId}`, name: petName }],
  checklist: allDone,
});

const home = (overrides: Partial<HomeData>): HomeData => ({
  state: 'B1',
  owner: { firstName: 'Phuong' },
  pets: [{ id: 'pet-max', name: 'Max', species: 'dog' }],
  hasPastStays: false,
  upcomingStays: [],
  currentStays: [],
  needsAttention: [],
  getReady: [],
  ...overrides,
});

const renderHome = (data: HomeData): void => {
  render(
    <MemoryRouter>
      <HomeContent home={data} />
    </MemoryRouter>,
  );
};

beforeEach(() => {
  vi.mocked(fetchMyBookings).mockReset().mockResolvedValue([]);
});

describe('Home: the manager decision', () => {
  it('asks the parent to try other dates for a refused request, with the reason', () => {
    renderHome(home({ needsAttention: [refusedMax] }));

    const section = within(screen.getByRole('region', { name: 'Needs your attention' }));
    expect(section.getByText('Max, 12 to 16 Oct')).toBeInTheDocument();
    // The status is in words, not only in the red tint.
    expect(section.getByText('Not accepted')).toBeInTheDocument();
    expect(section.getByText('Our manager said: We are full that week.')).toBeInTheDocument();
    expect(section.getByRole('link', { name: 'Try other dates for Max' })).toHaveAttribute(
      'href',
      '/parent/booking',
    );
  });

  it('still explains a refusal the manager gave no reason for', () => {
    renderHome(home({ needsAttention: [{ ...refusedMax, refusalReason: null }] }));
    expect(screen.getByText('Our manager could not accept this request.')).toBeInTheDocument();
  });

  it('shows no attention card when nothing was refused', () => {
    renderHome(home({}));
    expect(screen.queryByRole('region', { name: 'Needs your attention' })).not.toBeInTheDocument();
  });

  it('says a later request is waiting for review instead of "All set"', () => {
    renderHome(
      home({
        state: 'C1',
        upcomingStays: [
          upcoming('hero', 'Max', 'approved'),
          upcoming('pending', 'Luna', 'waiting_for_review'),
          upcoming('approved', 'Rex', 'approved'),
        ],
      }),
    );

    const rows = within(screen.getByRole('region', { name: 'Also coming up' }));
    expect(
      within(rows.getByRole('link', { name: /Luna/ })).getByText('Waiting for review'),
    ).toBeInTheDocument();
    expect(
      within(rows.getByRole('link', { name: /Rex/ })).getByText('All set'),
    ).toBeInTheDocument();
  });
});

describe('Home: the manager decision in Chinese', () => {
  afterEach(() => {
    act(() => useConciergeStore.getState().setLocale('en'));
  });

  // A reason typed before the presets has no translation: Chinese says so and offers the words.
  it('writes the refused request in Chinese and keeps an untranslated reason behind a tap', () => {
    useConciergeStore.getState().setLocale('zh');
    renderHome(home({ needsAttention: [refusedMax] }));

    const section = within(screen.getByRole('region', { name: '需要你处理' }));
    expect(section.getByText('Max，10月12日至16日')).toBeInTheDocument();
    expect(section.getByText(/经理说：原因是用英文写的。/)).toBeInTheDocument();
    expect(section.getByText('查看原文')).toBeInTheDocument();
    // The link's name starts with its visible words, so a voice user can still say them.
    expect(section.getByRole('link', { name: '换个日期试试（Max）' })).toHaveTextContent(
      '换个日期试试',
    );

    act(() => useConciergeStore.getState().setLocale('en'));

    expect(screen.getByRole('region', { name: 'Needs your attention' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Try other dates for Max' })).toBeInTheDocument();
  });

  it('translates a preset reason', () => {
    useConciergeStore.getState().setLocale('zh');
    renderHome(
      home({
        needsAttention: [{ ...refusedMax, refusalReason: 'We are fully booked on those dates.' }],
      }),
    );

    expect(screen.getByText('经理说：那几天已经住满了。')).toBeInTheDocument();
  });

  it('writes the compact row status in Chinese', () => {
    useConciergeStore.getState().setLocale('zh');
    renderHome(
      home({
        state: 'C1',
        upcomingStays: [upcoming('hero', 'Max', 'approved'), upcoming('next', 'Rex', 'approved')],
      }),
    );

    const rows = within(screen.getByRole('region', { name: '其他即将到来的住宿' }));
    expect(
      within(rows.getByRole('link', { name: /Rex/ })).getByText('都准备好了'),
    ).toBeInTheDocument();
    expect(within(rows.getByRole('link', { name: /Rex/ })).getByText(/5 天后/)).toBeInTheDocument();
  });
});

describe('Home: the refusal names the manager', () => {
  it('says which manager refused, so the parent knows who to ask', () => {
    renderHome(home({ needsAttention: [{ ...refusedMax, reviewerName: 'James' }] }));

    expect(
      screen.getByText('James, our manager, said: We are full that week.'),
    ).toBeInTheDocument();
  });
});
