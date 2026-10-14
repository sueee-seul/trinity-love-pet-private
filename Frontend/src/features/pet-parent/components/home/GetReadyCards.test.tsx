import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useConciergeStore } from '../../../concierge/store/conciergeStore';
import { fetchMyBookings } from '../../api/bookingApi';
import type { GetReadyStay } from '../../types/getReady';
import type { HomeData } from '../../types/home';
import { HomeContent } from './HomeContent';

vi.mock('../../api/bookingApi', () => ({ fetchMyBookings: vi.fn() }));

const DROP_OFF = new Date(2026, 9, 12, 9, 0).toISOString();

const maxGetReady: GetReadyStay = {
  bookingPetId: 'bp-max',
  bookingId: 'b1',
  petId: 'pet-max',
  petName: 'Max',
  dropOffAt: DROP_OFF,
  tasks: [
    { key: 'vaccination', status: 'completed' },
    { key: 'feeding', status: 'not_started' },
    { key: 'medication', status: 'completed' },
    { key: 'emergency_contact_and_vet', status: 'completed' },
  ],
};

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

describe('Get ready on Home', () => {
  it('shows a card with the count for a stay the server put in the 48 hour window', () => {
    renderHome(home({ getReady: [maxGetReady] }));

    const card = screen.getByRole('region', { name: "Get ready for Max's stay" });
    expect(within(card).getByText('3 of 4 done')).toBeInTheDocument();
    expect(within(card).getByText('Check-in 12 Oct 2026, 9:00 am')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'Feeding' })).toHaveAttribute(
      'href',
      '/parent/pets/pet-max',
    );
    expect(within(card).getByRole('link', { name: 'Vaccination proof' })).toHaveAttribute(
      'href',
      '/parent/vaccination/bp-max',
    );
    expect(
      within(card).getByText(
        'Our team checks your recorded emergency vet consent. Current online bookings include consent up to NZ$500; older bookings may need a signature.',
      ),
    ).toBeInTheDocument();
  });

  it('shows one card for each pet, in the order the server sent', () => {
    const luna: GetReadyStay = {
      ...maxGetReady,
      bookingPetId: 'bp-luna',
      petId: 'pet-luna',
      petName: 'Luna',
    };
    renderHome(home({ getReady: [luna, maxGetReady] }));

    expect(
      screen.getAllByRole('heading', { name: /^Get ready for/ }).map((h) => h.textContent),
    ).toEqual(["Get ready for Luna's stay", "Get ready for Max's stay"]);
  });

  it('shows no card while no approved stay is within 48 hours', () => {
    renderHome(home({}));

    expect(screen.queryByRole('heading', { name: /^Get ready for/ })).not.toBeInTheDocument();
  });
});

describe('Get ready on Home in Chinese', () => {
  afterEach(() => {
    act(() => useConciergeStore.getState().setLocale('en'));
  });

  it('writes the card, the tasks and the check-in checks in Chinese, then English again', () => {
    useConciergeStore.getState().setLocale('zh');
    renderHome(home({ getReady: [maxGetReady] }));

    const card = screen.getByRole('region', { name: '为 Max 的住宿做准备' });
    expect(within(card).getByText('已完成 3/4')).toBeInTheDocument();
    // The date stays in the shared English format; only the label around it is translated.
    expect(within(card).getByText('入住时间：2026年10月12日 上午9:00')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: /^饮食/ })).toHaveAttribute(
      'href',
      '/parent/pets/pet-max',
    );
    expect(within(card).getByText('Max 吃什么、吃多少、什么时候吃。')).toBeInTheDocument();
    expect(within(card).getByText('未开始')).toBeInTheDocument();
    expect(within(card).getAllByText('已完成')).toHaveLength(3);
    expect(within(card).getByText('入住时')).toBeInTheDocument();
    expect(
      within(card).getByText('没有疫苗证明的话，在确认疫苗情况之前，Max 会和其他宠物分开安置。'),
    ).toBeInTheDocument();

    act(() => useConciergeStore.getState().setLocale('en'));

    expect(screen.getByRole('region', { name: "Get ready for Max's stay" })).toBeInTheDocument();
    expect(screen.getByText('At check-in')).toBeInTheDocument();
  });
});
