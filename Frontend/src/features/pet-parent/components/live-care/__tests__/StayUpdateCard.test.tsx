import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StayUpdateCard } from '../StayUpdateCard';
import { fetchStaySummaries } from '../../../api/staySummariesApi';
import { fetchNotificationPreferences } from '../../../profile/notificationPreferencesApi';
import type { NotificationPreferencesResponse } from '../../../types/notificationPreferences';
import { useConciergeStore } from '../../../../concierge/store/conciergeStore';
import type { LiveCareData, StaySummary } from '../../../types/liveCare';

vi.mock('../../../api/staySummariesApi', () => ({ fetchStaySummaries: vi.fn() }));
vi.mock('../../../profile/notificationPreferencesApi', () => ({
  fetchNotificationPreferences: vi.fn(),
}));

const preferencesWithHour = (digestHour: number): NotificationPreferencesResponse => ({
  preferences: { locale: 'en', digestHour, quietStart: 22, quietEnd: 7, emailUpdates: true },
  saved: true,
});

// 13 Dec 2026 in Auckland (daylight saving, UTC+13). 01:00 UTC is 2:00 pm there; 05:00 UTC is 6 pm.
const TODAY = '2026-12-13';
const YESTERDAY = '2026-12-12';
const TWO_PM_TODAY = new Date('2026-12-13T01:00:00.000Z');
const SIX_PM_TODAY = new Date('2026-12-13T05:00:00.000Z');

const careDay: LiveCareData = {
  bookingPetId: 'bp-biscuit',
  petId: 'pet-biscuit',
  petName: 'Biscuit',
  sitterName: 'Sam',
  location: 'Wagstay Auckland',
  dropOffDate: '2026-12-11',
  pickUpDate: '2026-12-15',
  availableDates: ['2026-12-11', YESTERDAY, TODAY, '2026-12-14', '2026-12-15'],
  selectedDate: TODAY,
  entries: [],
  stats: [],
};

const summary = (overrides: Partial<StaySummary>): StaySummary => ({
  id: 'sum-1',
  bookingPetId: 'bp-biscuit',
  date: TODAY,
  kind: 'daily',
  locale: 'en',
  body: 'Biscuit had all 2 meals and 1 walk. Staff wrote: loved the yard.',
  // The api client has already turned the server's path into a URL the browser can load.
  photoPath: '/api/tasks/task-1/photos/yard.jpg?inline=1',
  media: { kind: 'photo', url: '/api/tasks/task-1/photos/yard.jpg?inline=1' },
  facts: {},
  // 04:02 UTC is 5:02 pm in Auckland.
  generatedAt: '2026-12-13T04:02:00.000Z',
  ...overrides,
});

const report = summary({
  id: 'sum-report',
  kind: 'stay_report',
  date: '2026-12-15',
  body: 'Biscuit stayed 4 nights. Every dose was given.',
  photoPath: null,
  media: null,
  generatedAt: '2026-12-15T04:10:00.000Z',
});

/** Fixes the clock without faking timers, so Testing Library's waits keep running. */
const setClock = (now: Date): void => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(now);
};

const renderCard = (date: string): ReturnType<typeof render> =>
  render(<StayUpdateCard bookingPetId="bp-biscuit" date={date} careDay={careDay} />);

/** Lets the answer land and the component settle, for cases where nothing should render. */
const settle = async (): Promise<void> => {
  await waitFor(() => expect(fetchStaySummaries).toHaveBeenCalledTimes(1));
  await act(async () => {
    await Promise.resolve();
  });
};

beforeEach(() => {
  vi.mocked(fetchNotificationPreferences).mockResolvedValue(preferencesWithHour(17));
});

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  useConciergeStore.getState().setLocale('en');
});

describe('StayUpdateCard', () => {
  it("shows today's update with its sentences, photo and the time it was sent", async () => {
    setClock(SIX_PM_TODAY);
    vi.mocked(fetchStaySummaries).mockResolvedValue([summary({})]);
    renderCard(TODAY);

    expect(
      await screen.findByRole('heading', { level: 3, name: "Today's update" }),
    ).toBeInTheDocument();
    expect(fetchStaySummaries).toHaveBeenCalledWith('bp-biscuit');
    expect(
      screen.getByText('Biscuit had all 2 meals and 1 walk. Staff wrote: loved the yard.'),
    ).toBeInTheDocument();
    const photo = screen.getByRole('img', { name: 'Photo of Biscuit from this update' });
    expect(photo).toHaveAttribute('src', '/api/tasks/task-1/photos/yard.jpg?inline=1');
    expect(photo).toHaveAttribute('loading', 'lazy');
    expect(screen.getByText(/^Sent at 5:02\spm$/)).toBeInTheDocument();
    expect(screen.queryByText("Today's update arrives after 5 pm.")).not.toBeInTheDocument();
  });

  it("plays the day's short video only when asked, muted, with a name a screen reader reads", async () => {
    setClock(SIX_PM_TODAY);
    const videoUrl = '/api/tasks/task-1/photos/yard.mp4?inline=1';
    vi.mocked(fetchStaySummaries).mockResolvedValue([
      summary({ photoPath: videoUrl, media: { kind: 'video', url: videoUrl } }),
    ]);
    renderCard(TODAY);

    const video = await screen.findByLabelText('Short video of Biscuit from this update');
    expect(video.tagName).toBe('VIDEO');
    expect(video).toHaveAttribute('src', videoUrl);
    expect(video).toHaveAttribute('controls');
    expect(video).toHaveAttribute('playsinline');
    expect(video).toHaveAttribute('preload', 'metadata');
    expect(video).not.toHaveAttribute('autoplay');
    expect((video as HTMLVideoElement).muted).toBe(true);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('shows the short video on the stay report when it carries one', async () => {
    setClock(SIX_PM_TODAY);
    const videoUrl = '/api/tasks/task-9/photos/goodbye.mov?inline=1';
    vi.mocked(fetchStaySummaries).mockResolvedValue([
      { ...report, photoPath: videoUrl, media: { kind: 'video', url: videoUrl } },
    ]);
    renderCard(TODAY);

    expect(await screen.findByLabelText('Short video of Biscuit from this update')).toHaveAttribute(
      'src',
      videoUrl,
    );
  });

  it('names the day when the update is for a day before today, and shows no photo when there is none', async () => {
    setClock(SIX_PM_TODAY);
    vi.mocked(fetchStaySummaries).mockResolvedValue([
      summary({ id: 'sum-0', date: YESTERDAY, photoPath: null, media: null }),
    ]);
    renderCard(YESTERDAY);

    expect(
      await screen.findByRole('heading', { level: 3, name: 'Update for 12 Dec' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('says when the update comes, on the current day before 5 pm with none yet', async () => {
    setClock(TWO_PM_TODAY);
    vi.mocked(fetchStaySummaries).mockResolvedValue([]);
    renderCard(TODAY);

    expect(await screen.findByText("Today's update arrives after 5 pm.")).toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it("names the parent's own hour when they chose one on My account", async () => {
    setClock(TWO_PM_TODAY);
    vi.mocked(fetchNotificationPreferences).mockResolvedValue(preferencesWithHour(19));
    vi.mocked(fetchStaySummaries).mockResolvedValue([]);
    renderCard(TODAY);

    expect(await screen.findByText("Today's update arrives after 7 pm.")).toBeInTheDocument();
  });

  it('shows nothing when the chosen hour has passed and the update is on its way', async () => {
    setClock(TWO_PM_TODAY);
    vi.mocked(fetchNotificationPreferences).mockResolvedValue(preferencesWithHour(13));
    vi.mocked(fetchStaySummaries).mockResolvedValue([]);
    const { container } = renderCard(TODAY);
    await settle();

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('shows the arrival note over the waiting line on drop-off day, before the daily update', async () => {
    setClock(TWO_PM_TODAY);
    vi.mocked(fetchStaySummaries).mockResolvedValue([
      summary({
        id: 'sum-arrival',
        kind: 'arrival',
        body: 'Biscuit has arrived and is settling in.',
        // 22:30 UTC the day before is 11:30 am today in Auckland.
        generatedAt: '2026-12-12T22:30:00.000Z',
      }),
    ]);
    renderCard(TODAY);

    expect(
      await screen.findByRole('heading', { level: 3, name: 'Settled in' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Biscuit has arrived and is settling in.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Photo of Biscuit from this update' })).toHaveAttribute(
      'src',
      '/api/tasks/task-1/photos/yard.jpg?inline=1',
    );
    expect(screen.getByText(/^Sent at 11:30\sam$/)).toBeInTheDocument();
    expect(screen.getByText("Today's update arrives after 5 pm.")).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: "Today's update" })).not.toBeInTheDocument();
  });

  it('renders nothing for a past day with no update', async () => {
    setClock(TWO_PM_TODAY);
    vi.mocked(fetchStaySummaries).mockResolvedValue([summary({})]);
    const { container } = renderCard(YESTERDAY);

    await settle();

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing while the first answer is on its way', () => {
    setClock(SIX_PM_TODAY);
    vi.mocked(fetchStaySummaries).mockReturnValue(new Promise(() => undefined));
    const { container } = renderCard(TODAY);

    expect(container).toBeEmptyDOMElement();
  });

  it('shows the stay report whichever day is picked, and Share copies its text', async () => {
    const user = userEvent.setup();
    setClock(SIX_PM_TODAY);
    vi.mocked(fetchStaySummaries).mockResolvedValue([report, summary({})]);
    renderCard(YESTERDAY);

    expect(
      await screen.findByRole('heading', { level: 3, name: 'How the stay went' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Biscuit stayed 4 nights. Every dose was given.')).toBeInTheDocument();
    // The report is not the day's update, so the day's own card does not appear for yesterday.
    expect(screen.queryByRole('heading', { name: "Today's update" })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Share' }));

    expect(await navigator.clipboard.readText()).toBe(
      'How the stay went\n\nBiscuit stayed 4 nights. Every dose was given.',
    );
    expect(screen.getByRole('status')).toHaveTextContent('Copied');
  });

  it('says what went wrong and loads the updates again on Try again', async () => {
    const user = userEvent.setup();
    setClock(SIX_PM_TODAY);
    vi.mocked(fetchStaySummaries)
      .mockRejectedValueOnce(new Error('Network down'))
      .mockResolvedValueOnce([summary({})]);
    renderCard(TODAY);

    expect(await screen.findByRole('alert')).toHaveTextContent('Network down');
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(
      await screen.findByRole('heading', { level: 3, name: "Today's update" }),
    ).toBeInTheDocument();
    expect(fetchStaySummaries).toHaveBeenCalledTimes(2);
  });

  it('writes its own words in Chinese and keeps the update as the server wrote it', async () => {
    useConciergeStore.getState().setLocale('zh');
    setClock(SIX_PM_TODAY);
    vi.mocked(fetchStaySummaries).mockResolvedValue([report, summary({})]);
    renderCard(TODAY);

    expect(await screen.findByRole('heading', { level: 3, name: '今日动态' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: '这次住宿的情况' })).toBeInTheDocument();
    expect(screen.getByText('发送时间：下午5:02')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '分享' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '这条动态里Biscuit的照片' })).toBeInTheDocument();
    expect(
      screen.getByText('Biscuit had all 2 meals and 1 walk. Staff wrote: loved the yard.'),
    ).toBeInTheDocument();
  });
});
