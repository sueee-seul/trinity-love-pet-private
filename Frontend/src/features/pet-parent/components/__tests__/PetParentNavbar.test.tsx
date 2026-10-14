import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { authApi } from '../../../../shared/auth/api/authApi';
import { useAuthStore } from '../../../../shared/auth/store/authStore';
import { BRAND_MARK_SRC } from '../../../../shared/brand/BrandMark';
import { useConciergeStore } from '../../../concierge/store/conciergeStore';
import { AiChatFloatingPanel } from '../../ai-chat/components/AiChatFloatingPanel';
import { useAiChatStore } from '../../ai-chat/store';
import { fetchNotifications } from '../../api/notificationsApi';
import { PetParentNavbar } from '../PetParentNavbar';

// The navbar loads the profile for the avatar; these tests only need the header itself.
vi.mock('../../profile/useProfileSync', () => ({ useProfileSync: vi.fn() }));
// The bell loads its notices from the server; these tests only need the header.
vi.mock('../../api/notificationsApi', () => ({
  fetchNotifications: vi.fn().mockResolvedValue({ items: [], unreadCount: 0 }),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}));
vi.mock('../../../../shared/auth/api/authApi', () => ({
  authApi: { logout: vi.fn() },
}));

const signIn = (): void => {
  useAuthStore.setState({
    user: {
      email: 'phuong@example.com',
      name: 'Phuong Nguyen',
      is_employee: false,
      is_pet_owner: true,
    },
    isAuthenticated: true,
    isHydrating: false,
  });
};

const renderAt = (path: string): void => {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<h1>Landing page</h1>} />
        <Route path="/signup" element={<h1>Pet Parent signup</h1>} />
        <Route path="*" element={<PetParentNavbar />} />
      </Routes>
    </MemoryRouter>,
  );
};

const currentLinks = (navName: string): string[] =>
  within(screen.getByRole('navigation', { name: navName }))
    .getAllByRole('link')
    .filter((link) => link.getAttribute('aria-current') === 'page')
    .map((link) => link.textContent ?? '');

// jsdom has no matchMedia; this answers every query the way a phone or a wider screen would.
const setScreen = (wide: boolean): void => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn((query: string) => ({
      matches: wide,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
};

beforeEach(() => {
  vi.mocked(authApi.logout).mockReset().mockResolvedValue({ ok: true, data: {} });
  vi.mocked(fetchNotifications).mockClear();
});

afterEach(() => {
  useAuthStore.setState({ user: null, isAuthenticated: false, isHydrating: false });
  useAiChatStore.setState({ isPanelOpen: false, isPanelMinimized: false });
  Reflect.deleteProperty(window, 'matchMedia');
  useConciergeStore.getState().setLocale('en');
});

describe('PetParentNavbar language', () => {
  // The language switch lives in the accessibility tools; the menu follows the site setting.
  it('switches the menu to Chinese and back with the site language', () => {
    setScreen(true);
    signIn();
    renderAt('/parent/stays');
    const main = (): HTMLElement => screen.getByRole('navigation', { name: 'Main' });
    expect(within(main()).getByRole('link', { name: 'My stays' })).toBeTruthy();

    act(() => useConciergeStore.getState().setLocale('zh'));

    const mainZh = screen.getByRole('navigation', { name: '主导航' });
    expect(within(mainZh).getByRole('link', { name: '我的住宿' })).toBeTruthy();

    act(() => useConciergeStore.getState().setLocale('en'));
    expect(within(main()).getByRole('link', { name: 'My stays' })).toBeTruthy();
  });
});

// The number in an element's `z-*` class. jsdom has no layout, so the stacking order is read
// from the classes that set it.
const zIndexOf = (element: HTMLElement): number => {
  const layer = [...element.classList].find((name) => /^z-\d+$/.test(name));
  if (!layer) throw new Error(`No z-index class on <${element.tagName.toLowerCase()}>`);
  return Number(layer.slice('z-'.length));
};

describe('PetParentNavbar', () => {
  it('navigates the Pet Parent signup button to the signup page', () => {
    renderAt('/parent');

    fireEvent.click(screen.getByRole('link', { name: 'Sign up' }));

    expect(screen.getByRole('heading', { name: 'Pet Parent signup' })).toBeInTheDocument();
  });

  it('names the brand Wagstay in both headers and links it to the front page', () => {
    renderAt('/parent');

    const brandLinks = screen.getAllByRole('link', { name: 'Wagstay' });
    expect(brandLinks).toHaveLength(2);
    brandLinks.forEach((link) => expect(link).toHaveAttribute('href', '/'));
    expect(screen.queryByText(/LiveCare/)).not.toBeInTheDocument();
    // Both carry the one fixed paw, which is decorative: the wordmark names the link.
    for (const link of brandLinks) {
      expect(link.querySelector(`img[src="${BRAND_MARK_SRC}"][alt=""]`)).not.toBeNull();
    }
  });

  // navigation.css draws the current page as the solid pill from `aria-current`.
  it('draws the desktop items as pills and the current one from aria-current', () => {
    renderAt('/parent/live-care/stay-1');

    const desktop = within(screen.getByRole('navigation', { name: 'Main' }));
    for (const link of desktop.getAllByRole('link')) expect(link).toHaveClass('nav-pill');
    expect(currentLinks('Main')).toEqual(['My stays']);
    expect(screen.getByRole('navigation', { name: 'Tabs' })).toHaveClass('nav-tabbar');
  });

  it('lists the four desktop items and the five phone tabs in sentence case', () => {
    renderAt('/parent');

    const desktop = within(screen.getByRole('navigation', { name: 'Main' }));
    expect(desktop.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Home',
      'My stays',
      'Book a stay',
      'Feedback',
    ]);
    const tabs = within(screen.getByRole('navigation', { name: 'Tabs' }));
    expect(tabs.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Home',
      'Stays',
      'Book',
      'Chat',
      'Profile',
    ]);
    expect(tabs.getByRole('link', { name: 'Chat' })).toHaveAttribute('href', '/parent/ai-chat');
  });

  it.each([
    ['/parent', 'Home', 'Home'],
    ['/parent/', 'Home', 'Home'],
    ['/parent/stays', 'My stays', 'Stays'],
    ['/parent/live-care/bp-1', 'My stays', 'Stays'],
    ['/parent/vaccination/bp-1', 'My stays', 'Stays'],
    ['/parent/booking', 'Book a stay', 'Book'],
    ['/parent/feedback', 'Feedback', null],
    ['/parent/ai-chat', null, 'Chat'],
    ['/parent/pets/pet-1', null, 'Profile'],
  ] as const)('marks the section of %s as the current page', (path, desktopItem, phoneTab) => {
    renderAt(path);

    expect(currentLinks('Main')).toEqual(desktopItem ? [desktopItem] : []);
    expect(currentLinks('Tabs')).toEqual(phoneTab ? [phoneTab] : []);
  });

  it('draws the initials on the account button instead of sending the name to an avatar service', () => {
    signIn();
    renderAt('/parent');

    const accountButtons = screen.getAllByRole('button', { name: 'Account menu' });
    expect(accountButtons).toHaveLength(2);
    accountButtons.forEach((button) => {
      expect(button).toHaveTextContent('PN');
      expect(button.querySelector('img')).toBeNull();
    });
  });

  it('opens the same account menu from the phone header, with feedback and log out', () => {
    signIn();
    renderAt('/parent');
    const phoneHeader = screen.getAllByRole('banner')[1];
    const phoneAccountButton = within(phoneHeader).getByRole('button', { name: 'Account menu' });

    fireEvent.click(phoneAccountButton);

    expect(phoneAccountButton).toHaveAttribute('aria-expanded', 'true');
    const menu = within(phoneHeader);
    expect(menu.getByRole('link', { name: 'Profile' })).toHaveAttribute('href', '/parent/profile');
    expect(menu.getByRole('link', { name: 'Leave feedback' })).toHaveAttribute(
      'href',
      '/parent/feedback',
    );
    expect(menu.getByRole('button', { name: 'Account settings' })).toBeInTheDocument();

    fireEvent.click(menu.getByRole('button', { name: 'Log out' }));

    expect(authApi.logout).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(screen.getByRole('heading', { name: 'Landing page' })).toBeInTheDocument();
  });

  it('keeps both headers and the tab bar above the floating chat panel, so the account menu stays clickable', () => {
    signIn();
    useAiChatStore.setState({
      conversationsById: {},
      conversationIds: [],
      isPanelOpen: true,
      isPanelMinimized: false,
    });
    render(
      <MemoryRouter initialEntries={['/parent']}>
        <PetParentNavbar />
        <AiChatFloatingPanel />
      </MemoryRouter>,
    );

    const panelLayer = zIndexOf(screen.getByRole('region', { name: 'AI chat' }));
    const headers = screen.getAllByRole('banner');
    expect(headers).toHaveLength(2);
    headers.forEach((header) => expect(zIndexOf(header)).toBeGreaterThan(panelLayer));
    expect(zIndexOf(screen.getByRole('navigation', { name: 'Tabs' }))).toBeGreaterThan(panelLayer);
  });

  it('shows the bell in the desktop header and loads its notices once', async () => {
    setScreen(true);
    signIn();
    renderAt('/parent');

    const desktopHeader = screen.getAllByRole('banner')[0];
    expect(
      await within(desktopHeader).findByRole('button', { name: 'Open notifications' }),
    ).toBeInTheDocument();
    expect(window.matchMedia).toHaveBeenCalledWith('(min-width: 48rem)');
    expect(fetchNotifications).toHaveBeenCalledTimes(1);
  });

  // The desktop header is only hidden by CSS on a phone, so the bell moves into the phone header
  // and mounts there once: decisions and daily updates reach a phone too, with one notices load.
  it('shows the bell in the phone header only, and loads its notices once, on a phone', async () => {
    setScreen(false);
    signIn();
    renderAt('/parent');

    const [desktopHeader, phoneHeader] = screen.getAllByRole('banner');
    expect(
      await within(phoneHeader as HTMLElement).findByRole('button', { name: 'Open notifications' }),
    ).toBeInTheDocument();
    expect(
      within(desktopHeader as HTMLElement).queryByRole('button', { name: /notifications/i }),
    ).not.toBeInTheDocument();
    expect(fetchNotifications).toHaveBeenCalledTimes(1);
  });

  it('closes the account menu on Escape and returns focus to its button', () => {
    signIn();
    renderAt('/parent');
    const desktopAccountButton = within(screen.getAllByRole('banner')[0]).getByRole('button', {
      name: 'Account menu',
    });

    fireEvent.click(desktopAccountButton);
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(desktopAccountButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument();
    expect(desktopAccountButton).toHaveFocus();
  });
});
