import { afterEach, describe, expect, it, beforeEach, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { ProfilePage } from '../pages/ProfilePage';
import { resetProfileState } from '../repository';
import { fetchParentProfile } from '../parentProfileApi';
import { useAuthStore } from '../../../../shared/auth/store/authStore';
import { useConciergeStore } from '../../../concierge/store/conciergeStore';
import { englishWordsIn } from '../../../../shared/i18n/testing/englishWordsIn';
import { hanCharactersIn } from '../../../../shared/i18n/testing/hanCharactersIn';

// The profile store is PostgreSQL-only (there is no fixture behind it), so
// the page only has something to render once this stubbed call resolves.
vi.mock('../parentProfileApi', () => ({
  fetchParentProfile: vi.fn().mockResolvedValue({
    owner: {
      id: '00000000-0000-4000-8000-000000000101',
      fullName: 'Ava Mitchell',
      email: 'parent@example.test',
      phone: '021 000 1111',
      avatarUrl: null,
      address: '12 Queen Street, Auckland',
      dateOfBirth: null,
      emergencyContactNumber: '021 999 0000',
    },
    pets: [],
  }),
}));

// The notification card loads its own settings; the defaults with `saved: false` stand for a parent
// who has not chosen anything yet.
vi.mock('../notificationPreferencesApi', () => ({
  fetchNotificationPreferences: vi.fn().mockResolvedValue({
    preferences: { locale: 'en', digestHour: 17, quietStart: 22, quietEnd: 7, emailUpdates: true },
    saved: false,
  }),
  updateNotificationPreferences: vi.fn(),
}));

// The contacts card loads its own list; a parent who has named nobody yet.
vi.mock('../contactsApi', () => ({
  fetchContacts: vi.fn().mockResolvedValue([]),
  addContact: vi.fn(),
  updateContact: vi.fn(),
  removeContact: vi.fn(),
}));

const renderAt = (entry: string): void => {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/parent/profile" element={<ProfilePage />} />
        <Route path="/parent/stays" element={<p>Stays list</p>} />
      </Routes>
    </MemoryRouter>,
  );
};

describe('ProfilePage sidebar navigation', () => {
  beforeEach(() => {
    resetProfileState();
    useAuthStore.getState().login({
      email: 'parent@example.test',
      is_employee: false,
      is_pet_owner: true,
    });
  });

  it('groups the sidebar in customer words: account, stays and settings', () => {
    renderAt('/parent/profile');

    const nav = screen.getByRole('navigation', { name: 'Pet parent account sections' });
    for (const group of ['Account', 'Stays', 'Settings']) {
      expect(within(nav).getByText(group)).toBeInTheDocument();
    }
    for (const label of [
      'Profile',
      'My pets',
      'Emergency contacts',
      'Updates and notifications',
      'Account settings',
    ]) {
      expect(within(nav).getByRole('button', { name: label })).toBeInTheDocument();
    }
    // Stays are listed once, at /parent/stays; the sidebar links there instead of keeping a copy.
    expect(within(nav).getByRole('link', { name: 'My stays' })).toHaveAttribute(
      'href',
      '/parent/stays',
    );
    expect(within(nav).queryByText(/Organization|Stays & Bookings/)).not.toBeInTheDocument();
  });

  it('opens Profile by default and marks it as the current section', async () => {
    renderAt('/parent/profile');

    expect(screen.getByRole('button', { name: 'Profile' })).toHaveAttribute('aria-current', 'page');
    // The panel appears only after the server's profile arrives.
    expect(await screen.findByRole('heading', { name: 'At a glance' })).toBeInTheDocument();
  });

  it('has one page title, with the owner name as a section heading below it', async () => {
    renderAt('/parent/profile');
    await screen.findByRole('heading', { name: 'At a glance' });

    const pageTitles = screen.getAllByRole('heading', { level: 1 });
    expect(pageTitles).toHaveLength(1);
    expect(pageTitles[0]).toHaveTextContent('My account');
    expect(screen.getByRole('heading', { level: 2, name: 'Ava Mitchell' })).toBeInTheDocument();
  });

  it('shows each contact detail once', async () => {
    renderAt('/parent/profile');
    await screen.findByRole('heading', { name: 'At a glance' });

    expect(screen.getAllByText('parent@example.test')).toHaveLength(1);
    expect(screen.getAllByText('021 000 1111')).toHaveLength(1);
    expect(screen.getAllByText('12 Queen Street, Auckland')).toHaveLength(1);
    expect(screen.getByText('021 999 0000')).toBeInTheDocument();
  });

  it('keeps only the overview on Profile; contacts and update settings have their own views', async () => {
    renderAt('/parent/profile');
    await screen.findByRole('heading', { name: 'At a glance' });

    expect(screen.queryByRole('heading', { name: 'Emergency contacts' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Updates and notifications' }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Emergency contacts' }));
    expect(await screen.findByRole('heading', { name: 'Emergency contacts' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Emergency contacts' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.queryByRole('heading', { name: 'At a glance' })).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/collect/i);

    fireEvent.click(screen.getByRole('button', { name: 'Updates and notifications' }));
    expect(
      await screen.findByRole('heading', { name: 'Updates and notifications' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Updates and notifications' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(await screen.findByRole('radio', { name: 'Chinese' })).toBeInTheDocument();
  });

  it.each([
    ['contacts', 'Emergency contacts'],
    ['updates', 'Updates and notifications'],
  ])('opens the %s view from a link', async (tab, heading) => {
    renderAt(`/parent/profile?tab=${tab}`);

    expect(screen.getByRole('button', { name: heading })).toHaveAttribute('aria-current', 'page');
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
  });

  it('shows no Chinese character anywhere in English mode', async () => {
    renderAt('/parent/profile?tab=updates');
    await screen.findByRole('radio', { name: 'Chinese' });

    expect(hanCharactersIn(document.body)).toEqual([]);
  });

  it('switches to the pets section when its sidebar item is clicked', async () => {
    renderAt('/parent/profile');
    await screen.findByRole('heading', { name: 'At a glance' });

    fireEvent.click(screen.getByRole('button', { name: 'My pets' }));

    expect(screen.getByRole('heading', { name: 'My pets' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'My pets' })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('heading', { name: 'At a glance' })).not.toBeInTheDocument();
  });

  it('restores the section named in the tab query parameter', async () => {
    renderAt('/parent/profile?tab=pets');

    expect(screen.getByRole('button', { name: 'My pets' })).toHaveAttribute('aria-current', 'page');
    expect(await screen.findByText('You have not added a pet yet.')).toBeInTheDocument();
  });

  it('sends an old link to the retired stays tab to the stays list', () => {
    renderAt('/parent/profile?tab=stays');

    expect(screen.getByText('Stays list')).toBeInTheDocument();
    expect(
      screen.queryByRole('navigation', { name: 'Pet parent account sections' }),
    ).not.toBeInTheDocument();
  });

  it('falls back to Profile when the tab parameter is not a real section', () => {
    renderAt('/parent/profile?tab=not-a-section');

    expect(screen.getByRole('button', { name: 'Profile' })).toHaveAttribute('aria-current', 'page');
  });

  it('says the account could not be loaded, not that a save failed, and loads it on retry', async () => {
    // The store logs the failed load; keep the test output clean.
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(fetchParentProfile).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    renderAt('/parent/profile');

    expect(await screen.findByText('We could not load your account')).toBeVisible();
    expect(screen.queryByText('Not saved')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('heading', { name: 'At a glance' })).toBeInTheDocument();
    consoleSpy.mockRestore();
  });
});

describe('ProfilePage account settings flag', () => {
  beforeEach(() => {
    resetProfileState();
    useAuthStore.getState().login({
      email: 'parent@example.test',
      is_employee: false,
      is_pet_owner: true,
    });
  });

  it('opens Account Settings when arriving with the flag', async () => {
    renderAt('/parent/profile?settings=open');

    expect(await screen.findByRole('dialog', { name: /Account Settings/i })).toBeInTheDocument();
  });

  /**
   * Regression: the accessibility toolbar's theme button is pressed from this page as often as
   * from anywhere else, and that is a same-route navigation. React Router updates the query
   * string without remounting, so a `useState` initialiser reading the flag never runs again and
   * the panel stayed shut on the one page whose own link it is.
   */
  it('opens Account Settings when the flag arrives without a remount', async () => {
    // Stands in for the accessibility toolbar, which is mounted outside the routes and navigates
    // to this same path with the flag appended.
    const ToolbarStandIn = (): React.ReactElement => {
      const navigate = useNavigate();
      return (
        <button type="button" onClick={() => navigate('/parent/profile?settings=open')}>
          Other theme
        </button>
      );
    };

    render(
      <MemoryRouter initialEntries={['/parent/profile']}>
        <ToolbarStandIn />
        <Routes>
          <Route path="/parent/profile" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByRole('dialog', { name: /Account Settings/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Other theme' }));

    expect(await screen.findByRole('dialog', { name: /Account Settings/i })).toBeInTheDocument();
  });
});

describe('ProfilePage in Chinese', () => {
  beforeEach(() => {
    resetProfileState();
    useAuthStore.getState().login({
      email: 'parent@example.test',
      is_employee: false,
      is_pet_owner: true,
    });
    useConciergeStore.getState().setLocale('zh');
    expect(englishWordsIn(document.body, [])).toEqual([]);
  });

  afterEach(() => {
    useConciergeStore.getState().setLocale('en');
  });

  it('shows the account page in Chinese and switches back to English', async () => {
    renderAt('/parent/profile');

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('我的账户');
    const nav = screen.getByRole('navigation', { name: '宠物主人账户栏目' });
    expect(within(nav).getByRole('button', { name: '个人资料' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: '我的住宿' })).toHaveAttribute(
      'href',
      '/parent/stays',
    );
    expect(await screen.findByRole('heading', { name: '概览' })).toBeInTheDocument();
    expect(screen.getByText('0 只宠物')).toBeInTheDocument();
    // The emergency contact number sits in the overview; the contacts have their own view.
    expect(
      within(screen.getByRole('region', { name: '概览' })).getByText('紧急联系人'),
    ).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: '紧急联系人' })).toBeInTheDocument();
    fireEvent.click(within(nav).getByRole('button', { name: '动态与通知' }));
    expect(await screen.findByRole('radio', { name: '英文' })).toBeInTheDocument();
    expect(
      englishWordsIn(document.body, ['Ava', 'Mitchell', 'Queen', 'Street', 'Auckland']),
    ).toEqual([]);

    fireEvent.click(within(nav).getByRole('button', { name: '我的宠物' }));
    expect(screen.getByText('你还没有添加宠物。')).toBeInTheDocument();

    act(() => useConciergeStore.getState().setLocale('en'));

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('My account');
    expect(screen.getByText('You have not added a pet yet.')).toBeInTheDocument();
  });

  it('says in Chinese that the account could not be loaded', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(fetchParentProfile).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    renderAt('/parent/profile');

    expect(await screen.findByText('你的账户没有加载出来')).toBeVisible();
    expect(screen.getByText('连接不上 Wagstay。请检查网络，然后刷新页面。')).toBeVisible();
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument();
    consoleSpy.mockRestore();
  });
});
