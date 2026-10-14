import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useConciergeStore } from '../../../concierge/store/conciergeStore';
import { ApiError } from '../../api/bookingApi';
import { fetchHome } from '../../api/homeApi';
import type { HomeData } from '../../types/home';
import { PetParentDashboardPage } from '../PetParentDashboardPage';

vi.mock('../../api/homeApi', () => ({ fetchHome: vi.fn() }));

const bookFirstStay: HomeData = {
  state: 'B1',
  owner: { firstName: 'Phuong' },
  pets: [{ id: 'pet-max', name: 'Max', species: 'dog' }],
  hasPastStays: false,
  upcomingStays: [],
  currentStays: [],
  needsAttention: [],
  getReady: [],
};

const renderPage = (): void => {
  render(
    <MemoryRouter>
      <PetParentDashboardPage />
    </MemoryRouter>,
  );
};

beforeEach(() => {
  vi.mocked(fetchHome).mockReset();
});

afterEach(() => {
  act(() => useConciergeStore.getState().setLocale('en'));
});

describe('PetParentDashboardPage in Chinese', () => {
  it('says it is loading in Chinese', () => {
    vi.mocked(fetchHome).mockReturnValue(new Promise<HomeData>(() => undefined));
    useConciergeStore.getState().setLocale('zh');
    renderPage();

    expect(screen.getByRole('status')).toHaveTextContent('正在加载首页…');
  });

  it('writes its own failure message in the current language, and switches with it', async () => {
    vi.mocked(fetchHome).mockRejectedValue(new Error('offline'));
    useConciergeStore.getState().setLocale('zh');
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('首页加载出错了。');
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument();

    act(() => useConciergeStore.getState().setLocale('en'));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Something went wrong loading your homepage.',
    );
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  // The server writes its reasons in English, so Chinese uses the page's own words.
  it('shows the server explanation in English only', async () => {
    vi.mocked(fetchHome).mockRejectedValue(new ApiError('Session expired', 401, null));
    useConciergeStore.getState().setLocale('zh');
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('首页加载出错了。');

    act(() => useConciergeStore.getState().setLocale('en'));

    expect(screen.getByRole('alert')).toHaveTextContent('Session expired');
  });

  it('renders the homepage in Chinese once it loads', async () => {
    vi.mocked(fetchHome).mockResolvedValue(bookFirstStay);
    useConciergeStore.getState().setLocale('zh');
    renderPage();

    expect(
      await screen.findByRole('heading', { level: 1, name: '欢迎回来，Phuong' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '开始预订' })).toHaveAttribute(
      'href',
      '/parent/booking',
    );
  });
});
