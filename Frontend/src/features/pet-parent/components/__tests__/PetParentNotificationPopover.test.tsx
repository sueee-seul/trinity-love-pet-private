import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useConciergeStore } from '../../../concierge/store/conciergeStore';
import type { ParentNotification } from '../../types/notifications';
import { PetParentNotificationPopover } from '../PetParentNotificationPopover';
import { SiteLanguageProvider } from '../../../../app/SiteLanguageProvider';
import { englishWordsIn } from '../../../../shared/i18n/testing/englishWordsIn';

const api = vi.hoisted(() => ({
  fetchNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}));
vi.mock('../../api/notificationsApi', () => api);

const APPROVED: ParentNotification = {
  id: 'notice-2',
  kind: 'booking_approved',
  title: 'Approved',
  body: "Max's stay, 12 to 15 Oct 2026, is approved. Your boarding pass is in My stays.",
  facts: { template: 'approved', pets: ['Max'], dates: { start: '2026-10-12', end: '2026-10-15' } },
  createdAt: '2026-10-02T02:00:00.000Z',
  readAt: null,
};

const RECEIVED: ParentNotification = {
  id: 'notice-1',
  kind: 'booking_request_received',
  title: 'Request received',
  body: 'We got your request PB-ABC123 for Max, 12 to 15 Oct 2026.',
  facts: {
    template: 'received',
    reference: 'PB-ABC123',
    dates: { start: '2026-10-12', end: '2026-10-15' },
    confirmed: [],
    waiting: [{ name: 'Max', reasons: [] }],
  },
  createdAt: '2026-10-01T02:00:00.000Z',
  readAt: '2026-10-01T03:00:00.000Z',
};

const READ_AT = '2026-10-02T05:00:00.000Z';

// The bell sits in the header, which stays on screen while the page below it changes. The app's
// language provider is there too, as in the app: the shared bell takes its words from it.
const renderBell = (): void => {
  render(
    <MemoryRouter initialEntries={['/parent']}>
      <SiteLanguageProvider>
        <PetParentNotificationPopover />
        <Routes>
          <Route path="/parent" element={<h1>Home</h1>} />
          <Route path="/parent/stays" element={<h1>My stays</h1>} />
        </Routes>
      </SiteLanguageProvider>
    </MemoryRouter>,
  );
};

const bellButton = (): HTMLElement =>
  screen.getByRole('button', { name: /^(Open notifications|打开通知)/ });

beforeEach(() => {
  vi.clearAllMocks();
  api.fetchNotifications.mockResolvedValue({ items: [APPROVED, RECEIVED], unreadCount: 1 });
  api.markAllNotificationsRead.mockResolvedValue({ updatedIds: [APPROVED.id], readAt: READ_AT });
  api.markNotificationRead.mockResolvedValue({ id: APPROVED.id, readAt: READ_AT });
});

describe('PetParentNotificationPopover', () => {
  it('puts the unread count in the button name', async () => {
    renderBell();

    expect(
      await screen.findByRole('button', { name: 'Open notifications, 1 unread' }),
    ).toBeInTheDocument();
    expect(api.markAllNotificationsRead).not.toHaveBeenCalled();
  });

  it('opens on a click, never on hover, because opening marks notices read', async () => {
    const user = userEvent.setup();
    renderBell();
    await screen.findByRole('button', { name: 'Open notifications, 1 unread' });

    await user.hover(bellButton());
    expect(screen.queryByRole('region', { name: 'Notifications' })).not.toBeInTheDocument();

    await user.click(bellButton());
    expect(screen.getByRole('region', { name: 'Notifications' })).toBeInTheDocument();
  });

  it('lists the newest first and marks what it showed as read when opened', async () => {
    const user = userEvent.setup();
    renderBell();
    await screen.findByRole('button', { name: 'Open notifications, 1 unread' });

    await user.click(bellButton());

    const region = screen.getByRole('region', { name: 'Notifications' });
    const links = await within(region).findAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/parent/stays',
      '/parent/stays',
    ]);
    expect(links[0]).toHaveTextContent('New: Approved');
    expect(links[0]).toHaveTextContent(APPROVED.body);
    expect(links[1]).not.toHaveTextContent('New:');
    await waitFor(() =>
      expect(api.markAllNotificationsRead).toHaveBeenCalledWith(APPROVED.createdAt),
    );
    // Read now, so the count clears; the notice stays marked new while the bell is open.
    expect(await screen.findByRole('button', { name: 'Open notifications' })).toBeInTheDocument();
    expect(links[0]).toHaveTextContent('New: Approved');
  });

  it('shows an empty state and marks nothing when there are no notices', async () => {
    const user = userEvent.setup();
    api.fetchNotifications.mockResolvedValue({ items: [], unreadCount: 0 });
    renderBell();

    await user.click(bellButton());

    expect(
      await screen.findByText(
        'No notifications yet. When our manager decides on a request, you will see it here.',
      ),
    ).toBeInTheDocument();
    expect(api.markAllNotificationsRead).not.toHaveBeenCalled();
  });

  it('says it is loading until the first list arrives', async () => {
    const user = userEvent.setup();
    api.fetchNotifications.mockReturnValue(new Promise(() => undefined));
    renderBell();

    await user.click(bellButton());

    expect(screen.getByRole('status')).toHaveTextContent('Loading notifications…');
  });

  it('says when the list cannot load, and tries again on request', async () => {
    const user = userEvent.setup();
    api.fetchNotifications.mockRejectedValue(new Error('offline'));
    renderBell();

    await user.click(bellButton());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not load your notifications.',
    );

    api.fetchNotifications.mockResolvedValue({ items: [APPROVED], unreadCount: 1 });
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText(APPROVED.body)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('marks a notice read when followed, closes the bell and opens My stays', async () => {
    const user = userEvent.setup();
    // Opening could not mark it read, so following it does.
    api.markAllNotificationsRead.mockRejectedValue(new Error('offline'));
    renderBell();
    await screen.findByRole('button', { name: 'Open notifications, 1 unread' });

    await user.click(bellButton());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not mark your notifications as read.',
    );
    await user.click(screen.getByRole('link', { name: /Approved/ }));

    expect(api.markNotificationRead).toHaveBeenCalledWith(APPROVED.id);
    expect(screen.getByRole('heading', { name: 'My stays' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Notifications' })).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Open notifications' })).toBeInTheDocument();
  });

  it('does not mark an already read notice again when it is followed', async () => {
    const user = userEvent.setup();
    renderBell();

    await user.click(bellButton());
    await user.click(await screen.findByRole('link', { name: /Request received/ }));

    expect(api.markNotificationRead).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'My stays' })).toBeInTheDocument();
  });
});

describe('PetParentNotificationPopover in Chinese', () => {
  afterEach(() => {
    useConciergeStore.getState().setLocale('en');
  });

  // The server's English sentence is said again in Chinese from what it means.
  it('words the panel and the notices in Chinese, and switches back', async () => {
    useConciergeStore.getState().setLocale('zh');
    const user = userEvent.setup();
    renderBell();
    await screen.findByRole('button', { name: '打开通知，1 条未读' });

    await user.click(bellButton());

    const region = screen.getByRole('region', { name: '通知' });
    expect(within(region).getByRole('heading', { name: '通知' })).toBeInTheDocument();
    const links = await within(region).findAllByRole('link');
    expect(links[0]).toHaveTextContent('新通知：已确认');
    expect(links[0]).toHaveTextContent(
      'Max 的住宿（2026年10月12日至15日）已确认。住宿凭证在“我的住宿”里。',
    );
    expect(links[1]).toHaveTextContent(
      '我们收到了你的申请 PB-ABC123（2026年10月12日至15日）。经理会先查看Max，然后再确认。',
    );

    expect(englishWordsIn(region, ['Max', 'PB', 'ABC'])).toEqual([]);
    act(() => useConciergeStore.getState().setLocale('en'));
    expect(within(region).getByRole('heading', { name: 'Notifications' })).toBeInTheDocument();
    expect(links[0]).toHaveTextContent('New: Approved');
    expect(links[0]).toHaveTextContent(APPROVED.body);
  });

  it('shows the empty state and the load error in Chinese', async () => {
    useConciergeStore.getState().setLocale('zh');
    const user = userEvent.setup();
    api.fetchNotifications.mockResolvedValue({ items: [], unreadCount: 0 });
    renderBell();

    await user.click(bellButton());
    expect(
      await screen.findByText('还没有通知。经理处理你的申请后，结果会显示在这里。'),
    ).toBeInTheDocument();

    api.fetchNotifications.mockRejectedValue(new Error('offline'));
    await user.click(bellButton());
    await user.click(bellButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('无法加载你的通知。');
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument();
  });
});
