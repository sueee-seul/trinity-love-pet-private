import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LiveCareDashboardPage } from '../LiveCareDashboardPage';
import { fetchLiveCare } from '../../api/liveCareApi';
import { ApiError, fetchMyBookings } from '../../api/bookingApi';
import { useConciergeStore } from '../../../concierge/store/conciergeStore';
import { localIsoDate } from '../../components/live-care/liveCareDates';
import type { CareEntry, LiveCareData } from '../../types/liveCare';
import type { StayStatus, PetStay } from '../../types/stays';
import { englishWordsIn } from '../../../../shared/i18n/testing/englishWordsIn';

vi.mock('../../api/liveCareApi', () => ({ fetchLiveCare: vi.fn() }));
// No stay here has sent an update yet, so the update cards stay out of the way.
vi.mock('../../api/staySummariesApi', () => ({
  fetchStaySummaries: vi.fn(() => Promise.resolve([])),
}));

// Holds the page's "something changed" handler, so a test can play the server's signal.
const liveEvents = vi.hoisted(() => ({ refresh: (): void => undefined }));
vi.mock('../../../../shared/events/liveCareServerEvents', () => ({
  buildLiveCareEventsUrl: (bookingPetId: string): string => `/stream/${bookingPetId}`,
  subscribeToLiveCareServerEvents: (_url: string, onRefresh: () => void): (() => void) => {
    liveEvents.refresh = onRefresh;
    return (): void => undefined;
  },
}));
vi.mock('../../api/bookingApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/bookingApi')>()),
  fetchMyBookings: vi.fn(),
}));

const DAY_MS = 24 * 60 * 60 * 1000;
const daysFromNow = (days: number): Date => new Date(Date.now() + days * DAY_MS);

// The status the server would send for an approved stay on these dates, unless a test names one.
const approvedStatus = (from: number, to: number): StayStatus => {
  if (from > 0) return 'approved';
  return to < 0 ? 'stay_ended' : 'staying_now';
};

const stay = (
  bookingPetId: string,
  petName: string,
  from: number,
  to: number,
  status: StayStatus = approvedStatus(from, to),
): PetStay => ({
  bookingPetId,
  bookingId: 'b-hana',
  confirmationNumber: 'PB-HANA01',
  createdAt: daysFromNow(-20).toISOString(),
  pet: { id: `pet-${petName.toLowerCase()}`, name: petName },
  dropOffAt: daysFromNow(from).toISOString(),
  pickUpAt: daysFromNow(to).toISOString(),
  status,
  reviewStatus: status === 'waiting_for_review' ? 'pending' : 'approved',
  refusalReason: null,
  reviewerName: null,
  nights: to - from,
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
  getReady: null,
  checkInOutcome: null,
  dateChangesLeft: null,
  card: null,
});

const biscuit = stay('bp-biscuit', 'Biscuit', -1, 3);
const pepper = stay('bp-pepper', 'Pepper', -1, 3);

const entry = (overrides: Partial<CareEntry>): CareEntry => ({
  id: 'task-1',
  time: '8:00 AM',
  title: 'Breakfast',
  category: 'meal',
  icon: '🍽️',
  status: 'completed',
  ...overrides,
});

const liveCare = (from: PetStay, overrides: Partial<LiveCareData> = {}): LiveCareData => {
  const dropOffDate = localIsoDate(new Date(from.dropOffAt));
  const pickUpDate = localIsoDate(new Date(from.pickUpAt));
  return {
    bookingPetId: from.bookingPetId,
    // A live stay always has its pet; only a past stay can outlive a deleted profile.
    petId: from.pet.id ?? 'deleted-pet',
    petName: from.pet.name,
    sitterName: 'Sam',
    location: 'Wagstay Auckland',
    dropOffDate,
    pickUpDate,
    availableDates: [dropOffDate, localIsoDate(new Date()), pickUpDate],
    selectedDate: localIsoDate(new Date()),
    entries: [entry({})],
    stats: [{ label: 'Meals & Meds', value: '1/1' }],
    ...overrides,
  };
};

// Answers each stay's own live care, and 404 for any other id, as the server does.
const serveLiveCare = (...stays: PetStay[]): void => {
  vi.mocked(fetchLiveCare).mockImplementation((id) => {
    const found = stays.find((candidate) => candidate.bookingPetId === id);
    return found
      ? Promise.resolve(liveCare(found))
      : Promise.reject(new ApiError('No stay', 404, null));
  });
};

// A promise the test settles by hand, to control the order the answers arrive in.
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

const renderAt = (path: string): ReturnType<typeof render> =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/parent/live-care" element={<LiveCareDashboardPage />} />
        <Route path="/parent/live-care/:bookingPetId" element={<LiveCareDashboardPage />} />
      </Routes>
    </MemoryRouter>,
  );

afterEach(() => {
  vi.clearAllMocks();
  useConciergeStore.getState().setLocale('en');
});

describe('LiveCareDashboardPage', () => {
  it('gives the page one title, with the pet and the stay dates in the lead', async () => {
    vi.mocked(fetchLiveCare).mockResolvedValue(liveCare(biscuit));
    vi.mocked(fetchMyBookings).mockResolvedValue([biscuit]);
    renderAt('/parent/live-care/bp-biscuit');

    // The loading state has the same title, so wait for the stay itself before checking it.
    expect(await screen.findByText(/^Biscuit's stay, /)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Live care' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 2, name: 'Care by day' })).toBeInTheDocument();
  });

  it('lets a parent switch between two pets staying together, marking the one on screen', async () => {
    vi.mocked(fetchLiveCare).mockResolvedValue(liveCare(biscuit));
    vi.mocked(fetchMyBookings).mockResolvedValue([biscuit, pepper]);
    renderAt('/parent/live-care/bp-biscuit');

    const switcher = await screen.findByRole('navigation', { name: 'Pets staying now' });
    const biscuitLink = within(switcher).getByRole('link', { name: 'Biscuit' });
    const pepperLink = within(switcher).getByRole('link', { name: 'Pepper' });

    expect(biscuitLink).toHaveAttribute('aria-current', 'page');
    expect(pepperLink).not.toHaveAttribute('aria-current');
    expect(pepperLink).toHaveAttribute('href', '/parent/live-care/bp-pepper');
  });

  it('hides the switcher when only one pet is staying, and leaves out stays that are not under way', async () => {
    const pastPepper = stay('bp-pepper-old', 'Pepper', -30, -25);
    vi.mocked(fetchLiveCare).mockResolvedValue(liveCare(biscuit));
    vi.mocked(fetchMyBookings).mockResolvedValue([biscuit, pastPepper]);
    renderAt('/parent/live-care/bp-biscuit');

    await screen.findByText(/^Biscuit's stay, /);
    await vi.waitFor(() => expect(fetchMyBookings).toHaveBeenCalled());
    expect(screen.queryByRole('navigation', { name: 'Pets staying now' })).not.toBeInTheDocument();
  });

  it('keeps the pet picked last when the answers arrive out of order', async () => {
    const user = userEvent.setup();
    const pepperAnswer = deferred<LiveCareData>();
    const biscuitAnswer = deferred<LiveCareData>();
    vi.mocked(fetchLiveCare)
      .mockResolvedValueOnce(liveCare(biscuit))
      .mockReturnValueOnce(pepperAnswer.promise)
      .mockReturnValueOnce(biscuitAnswer.promise);
    vi.mocked(fetchMyBookings).mockResolvedValue([biscuit, pepper]);
    renderAt('/parent/live-care/bp-biscuit');

    const switcher = await screen.findByRole('navigation', { name: 'Pets staying now' });
    await user.click(within(switcher).getByRole('link', { name: 'Pepper' }));

    // While Pepper loads, Biscuit stays up but the page says it is moving to Pepper.
    expect(screen.getByRole('status')).toHaveTextContent("Loading Pepper's updates…");
    expect(within(switcher).getByRole('link', { name: 'Pepper' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await user.click(within(switcher).getByRole('link', { name: 'Biscuit' }));
    biscuitAnswer.resolve(liveCare(biscuit));
    expect(await screen.findByText(/^Biscuit's stay, /)).toBeInTheDocument();

    // Pepper's answer lands last, after the parent went back to Biscuit, and must be ignored.
    pepperAnswer.resolve(liveCare(pepper));
    await pepperAnswer.promise;
    expect(await screen.findByText(/^Biscuit's stay, /)).toBeInTheDocument();
    expect(screen.queryByText(/^Pepper's stay, /)).not.toBeInTheDocument();
    expect(within(switcher).getByRole('link', { name: 'Biscuit' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('opens the stay under way when the route has no id', async () => {
    const pastLuna = stay('bp-luna', 'Luna', -30, -25);
    const upcomingMax = stay('bp-max', 'Max', 5, 9);
    serveLiveCare(pastLuna, biscuit, upcomingMax);
    vi.mocked(fetchMyBookings).mockResolvedValue([pastLuna, biscuit, upcomingMax]);
    renderAt('/parent/live-care');

    expect(await screen.findByText(/^Biscuit's stay, /)).toBeInTheDocument();
    expect(fetchLiveCare).toHaveBeenCalledWith('bp-biscuit', undefined);
    expect(fetchLiveCare).not.toHaveBeenCalledWith(undefined, undefined);
  });

  it('never opens a pending request, even one whose dates have come', async () => {
    const pendingRex = stay('bp-rex', 'Rex', -1, 3, 'waiting_for_review');
    const lastLuna = stay('bp-luna', 'Luna', -12, -8);
    serveLiveCare(lastLuna);
    vi.mocked(fetchMyBookings).mockResolvedValue([pendingRex, lastLuna]);
    renderAt('/parent/live-care');

    expect(await screen.findByText(/^Luna's stay, /)).toBeInTheDocument();
    expect(fetchLiveCare).toHaveBeenCalledWith('bp-luna', undefined);
    expect(fetchLiveCare).not.toHaveBeenCalledWith('bp-rex', undefined);
    expect(screen.queryByRole('navigation', { name: 'Pets staying now' })).not.toBeInTheDocument();
  });

  it('prefers the stay that ended last over one still to come when none is under way', async () => {
    const olderLuna = stay('bp-luna-old', 'Luna', -60, -55);
    const lastLuna = stay('bp-luna', 'Luna', -12, -8);
    const upcomingMax = stay('bp-max', 'Max', 5, 9);
    serveLiveCare(olderLuna, lastLuna, upcomingMax);
    vi.mocked(fetchMyBookings).mockResolvedValue([olderLuna, upcomingMax, lastLuna]);
    renderAt('/parent/live-care');

    expect(await screen.findByText('Stay ended')).toBeInTheDocument();
    expect(fetchLiveCare).toHaveBeenCalledWith('bp-luna', undefined);
    expect(fetchLiveCare).toHaveBeenCalledTimes(1);
  });

  it('lets the server pick when the stays cannot be loaded', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.mocked(fetchLiveCare).mockResolvedValue(liveCare(pepper));
    vi.mocked(fetchMyBookings).mockRejectedValue(new Error('Network down'));
    renderAt('/parent/live-care');

    expect(await screen.findByText(/^Pepper's stay, /)).toBeInTheDocument();
    expect(fetchLiveCare).toHaveBeenCalledWith(undefined, undefined);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('shows what went wrong and loads the stay again on Try again', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchLiveCare)
      .mockRejectedValueOnce(new Error('Network down'))
      .mockResolvedValueOnce(liveCare(biscuit));
    vi.mocked(fetchMyBookings).mockResolvedValue([biscuit]);
    renderAt('/parent/live-care/bp-biscuit');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not load live care updates.',
    );
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText(/^Biscuit's stay, /)).toBeInTheDocument();
    expect(fetchLiveCare).toHaveBeenCalledTimes(2);
    expect(fetchLiveCare).toHaveBeenLastCalledWith('bp-biscuit', undefined);
  });

  it('says a stay still to come has not started, without the live badge', async () => {
    const upcomingMax = stay('bp-max', 'Max', 5, 9);
    vi.mocked(fetchLiveCare).mockResolvedValue(liveCare(upcomingMax));
    vi.mocked(fetchMyBookings).mockResolvedValue([upcomingMax]);
    const { container } = renderAt('/parent/live-care/bp-max');

    expect(await screen.findByText('Not started')).toBeInTheDocument();
    expect(screen.getByText('Updates start when Max arrives for the stay.')).toBeInTheDocument();
    expect(screen.queryByText('Staying now')).not.toBeInTheDocument();
    expect(screen.queryByText(/This page updates by itself/)).not.toBeInTheDocument();
    // The pulsing dot belongs to a stay under way only.
    expect(container.querySelector('[class*="animate-ping"]')).toBeNull();
  });

  it("moves focus to the close button when an entry's photos open", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchLiveCare).mockResolvedValue(
      liveCare(biscuit, {
        entries: [
          entry({
            id: 'task-play',
            title: 'Yard play',
            category: 'play',
            photos: ['/photos/one.jpg', '/photos/two.jpg'],
          }),
        ],
      }),
    );
    vi.mocked(fetchMyBookings).mockResolvedValue([biscuit]);
    renderAt('/parent/live-care/bp-biscuit');

    await user.click(await screen.findByRole('button', { name: 'View photos from Yard play' }));

    const dialog = screen.getByRole('dialog', { name: 'Photos from Yard play' });
    expect(within(dialog).getByRole('button', { name: 'Close photos' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Photos from Yard play' })).not.toBeInTheDocument();
  });

  it('only calls the stay live while it is in progress', async () => {
    vi.mocked(fetchLiveCare).mockResolvedValue(liveCare(biscuit));
    vi.mocked(fetchMyBookings).mockResolvedValue([biscuit]);
    renderAt('/parent/live-care/bp-biscuit');

    expect(await screen.findByText('Staying now')).toBeInTheDocument();
    expect(screen.getByText(/This page updates by itself/)).toBeInTheDocument();
  });

  it('says the stay has ended once the pet has been picked up', async () => {
    const pastBiscuit = stay('bp-biscuit-old', 'Biscuit', -10, -6);
    vi.mocked(fetchLiveCare).mockResolvedValue(liveCare(pastBiscuit));
    vi.mocked(fetchMyBookings).mockResolvedValue([pastBiscuit]);
    renderAt('/parent/live-care/bp-biscuit-old');

    expect(await screen.findByText('Stay ended')).toBeInTheDocument();
    expect(screen.queryByText('Staying now')).not.toBeInTheDocument();
    expect(screen.queryByText(/This page updates by itself/)).not.toBeInTheDocument();
    expect(
      screen.getByText("Biscuit's stay has ended. You can still look back at every day of it."),
    ).toBeInTheDocument();
  });

  it('marks the chosen day as pressed and loads another day when it is picked', async () => {
    const user = userEvent.setup();
    const data = liveCare(biscuit);
    vi.mocked(fetchLiveCare).mockResolvedValue(data);
    vi.mocked(fetchMyBookings).mockResolvedValue([biscuit]);
    renderAt('/parent/live-care/bp-biscuit');

    const days = await screen.findByRole('group', { name: 'Day of stay' });
    const today = within(days).getByRole('button', { pressed: true });
    expect(today).toHaveTextContent('Today');

    const [firstDay] = within(days).getAllByRole('button', { pressed: false });
    if (!firstDay) throw new Error('expected another day to pick');
    await user.click(firstDay);

    expect(fetchLiveCare).toHaveBeenLastCalledWith('bp-biscuit', data.dropOffDate);
  });

  it('never prints a stray 0 for an entry with no mood and no photos', async () => {
    vi.mocked(fetchLiveCare).mockResolvedValue(
      liveCare(biscuit, { entries: [entry({ photoCount: 0 })], stats: [] }),
    );
    vi.mocked(fetchMyBookings).mockResolvedValue([biscuit]);
    renderAt('/parent/live-care/bp-biscuit');

    const title = await screen.findByText('Breakfast');
    const card = title.closest('li');
    if (!card) throw new Error('expected the entry to render in a list item');
    expect(within(card).queryByText('0')).not.toBeInTheDocument();
    expect(within(card).queryByText(/photo/)).not.toBeInTheDocument();
  });

  it('points the parent back to My stays when there is no stay to show', async () => {
    vi.mocked(fetchLiveCare).mockRejectedValue(new ApiError('No stay', 404, null));
    vi.mocked(fetchMyBookings).mockResolvedValue([]);
    renderAt('/parent/live-care');

    expect(await screen.findByText('No stay to show live care for yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View my stays' })).toHaveAttribute(
      'href',
      '/parent/stays',
    );
  });
});

// The page says what the staff task pages say about each task.
describe('LiveCareDashboardPage in step with the staff pages', () => {
  const dayInStaffTerms = (): LiveCareData =>
    liveCare(biscuit, {
      sitterName: null,
      location: null,
      entries: [
        entry({ id: 'task-breakfast', title: 'Feeding (morning)', status: 'in_progress' }),
        entry({ id: 'task-groom', title: 'Grooming', time: null, status: 'upcoming' }),
        entry({
          id: 'task-dinner',
          title: 'Feeding (evening)',
          time: '7:00 PM',
          status: 'upcoming',
        }),
      ],
    });

  it('marks a started task in progress, words an untimed one, and names the team', async () => {
    vi.mocked(fetchLiveCare).mockResolvedValue(dayInStaffTerms());
    vi.mocked(fetchMyBookings).mockResolvedValue([biscuit]);
    renderAt('/parent/live-care/bp-biscuit');

    expect(await screen.findByText('Cared for by the Wagstay team')).toBeInTheDocument();
    expect(screen.queryByText('Wagstay Auckland')).not.toBeInTheDocument();
    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(screen.getByText('Time to be set')).toBeInTheDocument();
    // The untimed task cannot be next; the next timed one is.
    expect(screen.getByText('Next: Feeding (evening) at 7:00 PM')).toBeInTheDocument();
  });

  it('shows a photo staff just uploaded as soon as the server says so', async () => {
    const before = dayInStaffTerms();
    vi.mocked(fetchLiveCare).mockResolvedValue(before);
    vi.mocked(fetchMyBookings).mockResolvedValue([biscuit]);
    renderAt('/parent/live-care/bp-biscuit');
    expect(await screen.findByText('In progress')).toBeInTheDocument();
    expect(screen.queryByText('1 photo')).not.toBeInTheDocument();

    vi.mocked(fetchLiveCare).mockResolvedValue({
      ...before,
      entries: before.entries.map((item) =>
        item.id === 'task-breakfast'
          ? { ...item, status: 'completed', photos: ['/photos/bowl.jpg'] }
          : item,
      ),
    });
    act(() => liveEvents.refresh());

    expect(
      await screen.findByRole('button', { name: 'View photos from Feeding (morning)' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Photos of the day')).toBeInTheDocument();
    expect(screen.queryByText('In progress')).not.toBeInTheDocument();
  });

  it('says the same in Chinese', async () => {
    useConciergeStore.getState().setLocale('zh');
    vi.mocked(fetchLiveCare).mockResolvedValue(dayInStaffTerms());
    vi.mocked(fetchMyBookings).mockResolvedValue([biscuit]);
    renderAt('/parent/live-care/bp-biscuit');

    expect(await screen.findByText('由 Wagstay 团队照顾')).toBeInTheDocument();
    expect(screen.getByText('进行中')).toBeInTheDocument();
    expect(screen.getByText('时间待定')).toBeInTheDocument();
    expect(screen.getByText('下一项：下午 7:00 喂食（晚上）')).toBeInTheDocument();
    expect(englishWordsIn(document.body, ['Biscuit'])).toEqual([]);
  });
});

describe('LiveCareDashboardPage in Chinese', () => {
  // Known care tasks are named in Chinese; one staff named themselves shows its kind of care.
  it('writes the page and the care entries in Chinese', async () => {
    useConciergeStore.getState().setLocale('zh');
    vi.mocked(fetchLiveCare).mockResolvedValue(
      liveCare(biscuit, {
        entries: [
          entry({
            id: 'task-play',
            title: 'Yard play',
            category: 'play',
            photos: ['/photos/one.jpg'],
          }),
          entry({ id: 'task-dinner', title: 'Dinner', time: '5:30 PM', status: 'upcoming' }),
        ],
      }),
    );
    vi.mocked(fetchMyBookings).mockResolvedValue([biscuit, pepper]);
    renderAt('/parent/live-care/bp-biscuit');

    expect(await screen.findByText(/^Biscuit的住宿，\d+月\d+日至/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: '照顾动态' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '每日照顾' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '我的住宿' })).toHaveAttribute('href', '/parent/stays');
    expect(screen.getByText('由 Sam 照顾')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: '正在住宿的宠物' })).toBeInTheDocument();
    const days = screen.getByRole('group', { name: '住宿日期' });
    expect(within(days).getByRole('button', { pressed: true })).toHaveTextContent('今天');
    expect(screen.getByText('2 项照顾已完成 1 项')).toBeInTheDocument();
    expect(screen.getByText('下一项：下午 5:30 晚餐')).toBeInTheDocument();
    expect(screen.getByText('已完成')).toBeInTheDocument();
    expect(screen.getByText('待完成')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '查看“玩耍”的照片' })).toBeInTheDocument();
    expect(screen.getByText('当天照片')).toBeInTheDocument();
    expect(screen.getByText(/这个页面都会自动更新。最后更新：刚刚。/)).toBeInTheDocument();
    expect(screen.queryByText('Yard play')).not.toBeInTheDocument();
    expect(screen.queryByText(/Dinner|PM/)).not.toBeInTheDocument();

    // Apoquel is the medicine's name on the dose record; names are shown as written in any language.
    expect(
      englishWordsIn(document.body, ['Biscuit', 'Pepper', 'Sam', 'Auckland', 'Apoquel']),
    ).toEqual([]);
    act(() => useConciergeStore.getState().setLocale('en'));

    expect(screen.getByRole('heading', { level: 1, name: 'Live care' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Care by day' })).toBeInTheDocument();
    expect(screen.getByText(/^Biscuit's stay, /)).toBeInTheDocument();
    expect(screen.getByText('Boarding with Sam')).toBeInTheDocument();
    expect(screen.getByText('1 of 2 activities done')).toBeInTheDocument();
    expect(screen.queryByText('照顾动态')).not.toBeInTheDocument();
  });

  it('words a failure that carried no message in the chosen language', async () => {
    vi.mocked(fetchLiveCare).mockRejectedValue('offline');
    vi.mocked(fetchMyBookings).mockResolvedValue([biscuit]);
    renderAt('/parent/live-care/bp-biscuit');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not load live care updates.',
    );

    // A switch asks again (staff notes come translated for Chinese); it fails again, in Chinese.
    act(() => useConciergeStore.getState().setLocale('zh'));

    expect(await screen.findByRole('alert')).toHaveTextContent('照顾动态没有加载出来。');
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument();
  });
});
