import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  countCareByDay,
  hasSummary,
  insertSummary,
  listStayingPets,
  listSummariesForStay,
} from '../repositories/daily-summary.repository.js';
import { listAdministrationsForDay } from '../repositories/medication.administration.repository.js';
import {
  findBookingRequestSubject,
  recordParentNotice,
} from '../repositories/booking.notification.repository.js';
import { findDayTasks, findStayById } from '../repositories/petparent.livecare.repository.js';
import { sendBookingNoticeEmail } from '../services/booking.transaction-emails.js';
import { runDailySummaryPass, summariesForOwner } from '../services/daily-summary.service.js';
import { planMemoryNote, writeStayMemoryNote } from '../services/stay-memory.service.js';

vi.mock('../config/database.js', () => ({ pool: { query: vi.fn() } }));
vi.mock('../repositories/stay-photos.repository.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../repositories/stay-photos.repository.js')>()),
  listStayPhotos: vi.fn(async () => []),
}));

vi.mock('../repositories/daily-summary.repository.js', () => ({
  listStayingPets: vi.fn(async () => []),
  hasSummary: vi.fn(async () => false),
  insertSummary: vi.fn(async (summary: { body: string; kind: string }) => ({
    id: 's1',
    bookingPetId: 'bp-1',
    date: '2026-12-13',
    kind: summary.kind,
    body: summary.body,
    photoPath: null,
    facts: {},
    generatedAt: new Date('2026-12-13T04:05:00Z'),
  })),
  listSummariesForStay: vi.fn(async () => []),
  countCareByDay: vi.fn(async () => [
    { day: '2026-12-12', feedsDone: 1, feedsPlanned: 1, walks: 1, play: 0, photos: 1 },
    { day: '2026-12-13', feedsDone: 2, feedsPlanned: 2, walks: 0, play: 1, photos: 0 },
  ]),
}));

vi.mock('../repositories/medication.administration.repository.js', () => ({
  listAdministrationsForDay: vi.fn(async () => []),
}));

vi.mock('../repositories/booking.notification.repository.js', () => ({
  findBookingRequestSubject: vi.fn(async () => ({
    ownerId: 'owner-1',
    petNames: ['Bella'],
    dropOffTime: null,
    pickUpTime: null,
  })),
  recordParentNotice: vi.fn(async () => undefined),
}));

vi.mock('../repositories/petparent.livecare.repository.js', () => ({
  findDayTasks: vi.fn(async () => [
    {
      id: 't1',
      title: 'Feeding (morning)',
      status: 'completed',
      scheduled_at: new Date('2026-12-13T08:00:00Z'),
      description: null,
      photos: [{ photo_url: 'bella.jpg', caption: null }],
    },
  ]),
  findStayById: vi.fn(async () => ({ bookingPetId: 'bp-1', petOwnersUuid: 'owner-1' })),
}));

vi.mock('../services/booking.transaction-emails.js', () => ({
  sendBookingNoticeEmail: vi.fn(async () => undefined),
}));
vi.mock('../services/care-metrics.service.js', () => ({
  recordMetric: vi.fn(async () => undefined),
}));
vi.mock('../services/stay-memory.service.js', () => ({
  writeStayMemoryNote: vi.fn(async () => null),
  previousMemoryFacts: vi.fn(async () => null),
  planMemoryNote: vi.fn(() => ({ facts: {}, body: '', newTrends: [], parentLines: [] })),
}));
// The model rewording is its own module with its own tests; here the record goes out as written.
vi.mock('../services/daily-summary.writer.js', () => ({
  warmDailyUpdate: vi.fn(async (_facts: unknown, _locale: unknown, record: string) => ({
    body: record,
    writtenBy: 'record',
  })),
}));

const BELLA = {
  bookingPetsUuid: 'bp-1',
  bookingId: 'b-1',
  ownerId: 'owner-1',
  petUuid: 'pet-1',
  petName: 'Bella',
  dropOffAt: new Date('2026-12-11T21:30:00Z'),
  pickUpAt: new Date('2026-12-13T03:00:00Z'),
  checkInRecordedAt: new Date('2026-12-11T21:40:00Z'),
  locale: 'en' as const,
  digestHour: 17,
  quietStart: 22,
  quietEnd: 7,
  emailUpdates: true,
};

/** Sun 13 Dec 2026, 17:05 in Auckland: after the update hour, on Bella's pick-up day. */
const EVENING = new Date('2026-12-13T04:05:00Z');

beforeEach(() => {
  vi.clearAllMocks();
  // A value queued for a test that returned early must not leak into the next one.
  vi.mocked(listStayingPets).mockReset();
  vi.mocked(listStayingPets).mockResolvedValue([]);
  vi.mocked(hasSummary).mockReset();
  vi.mocked(hasSummary).mockResolvedValue(false);
});

describe('the daily summary pass', () => {
  it('does nothing before the update hour', async () => {
    vi.mocked(listStayingPets).mockResolvedValueOnce([BELLA]);
    await expect(runDailySummaryPass(new Date('2026-12-12T22:00:00Z'))).resolves.toEqual({
      updates: 0,
      reports: 0,
      arrivals: 0,
    });
    expect(insertSummary).not.toHaveBeenCalled();
  });

  it("follows the owner's own update hour, not the facility default", async () => {
    vi.mocked(listStayingPets).mockResolvedValueOnce([{ ...BELLA, digestHour: 9 }]);
    // 11:00 in Auckland on 12 Dec: after a 9 am digest hour, before the default 5 pm.
    const result = await runDailySummaryPass(new Date('2026-12-11T22:00:00Z'));
    expect(result.updates).toBe(1);
    expect(insertSummary).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'daily', locale: 'en', date: '2026-12-12' }),
    );
  });

  it('writes the update in Chinese for a parent who chose Chinese, and emails it with a Chinese subject', async () => {
    vi.mocked(listStayingPets).mockResolvedValueOnce([{ ...BELLA, locale: 'zh' }]);
    await runDailySummaryPass(EVENING);
    const summary = vi.mocked(insertSummary).mock.calls[0]?.[0];
    expect(summary?.locale).toBe('zh');
    expect(summary?.body).toContain('Bella吃了计划的那一餐。');
    expect(summary?.body).toContain('今天拍了1张照片');
    // Only the pet's name is Latin script; no English sentence slipped in.
    expect(summary?.body.replace(/Bella/g, '')).not.toMatch(/[a-z]{3,}/i);
    expect(recordParentNotice).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'booking_daily_update', locale: 'zh' }),
    );
    expect(sendBookingNoticeEmail).toHaveBeenCalledWith(
      expect.objectContaining({ locale: 'zh', body: expect.stringContaining('照顾动态') }),
    );
  });

  it('keeps the bell notice but sends no email when the parent turned update emails off', async () => {
    vi.mocked(listStayingPets).mockResolvedValueOnce([{ ...BELLA, emailUpdates: false }]);
    await runDailySummaryPass(EVENING);
    expect(recordParentNotice).toHaveBeenCalled();
    expect(sendBookingNoticeEmail).not.toHaveBeenCalled();
  });

  it('sends a settled-in note 90 minutes after the desk recorded the arrival, before the update hour', async () => {
    // Arrived 10:40 on Sat 12 Dec in Auckland; the pass runs at 12:15 the same day.
    const arrived = {
      ...BELLA,
      dropOffAt: new Date('2026-12-11T21:30:00Z'),
      checkInRecordedAt: new Date('2026-12-11T21:40:00Z'),
    };
    vi.mocked(listStayingPets).mockResolvedValueOnce([arrived]);
    const result = await runDailySummaryPass(new Date('2026-12-11T23:15:00Z'));
    expect(result.arrivals).toBe(1);
    const summary = vi.mocked(insertSummary).mock.calls[0]?.[0];
    expect(summary?.kind).toBe('arrival');
    expect(summary?.body).toBe(
      'Bella has arrived and is settling in with us. The first photo is on Live care. You will get the full update at 5 pm.',
    );
    expect(summary?.photoPath).toContain('bella.jpg');
    expect(recordParentNotice).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'booking_arrival_note' }),
    );
  });

  it("carries the day's newest short video over a photo, and names it in the update", async () => {
    vi.mocked(findDayTasks).mockResolvedValueOnce([
      {
        id: 't1',
        title: 'Playtime',
        status: 'completed',
        scheduled_at: new Date('2026-12-13T01:00:00Z'),
        description: null,
        photos: [{ photo_url: 'yard.mp4', caption: null }],
      },
      {
        id: 't2',
        title: 'Feeding (evening)',
        status: 'completed',
        scheduled_at: new Date('2026-12-13T03:00:00Z'),
        description: null,
        photos: [{ photo_url: 'dinner.jpg', caption: null }],
      },
    ]);
    vi.mocked(listStayingPets).mockResolvedValueOnce([BELLA]);
    await runDailySummaryPass(EVENING);
    const summary = vi.mocked(insertSummary).mock.calls[0]?.[0];
    expect(summary?.kind).toBe('daily');
    expect(summary?.photoPath).toBe('/tasks/t1/photos/yard.mp4?inline=1');
    expect(summary?.body).toContain('1 photo was taken today');
    expect(summary?.body).toContain('There is a short video of Bella from today');
    expect(summary?.facts).toMatchObject({ photos: 1, videos: 1 });
  });

  it('holds the settled-in note until 90 minutes have passed, and during quiet hours', async () => {
    const arrived = { ...BELLA, checkInRecordedAt: new Date('2026-12-11T22:30:00Z') };
    vi.mocked(listStayingPets).mockResolvedValueOnce([arrived]);
    // 12:15: only 45 minutes after the desk recorded the pet.
    await expect(runDailySummaryPass(new Date('2026-12-11T23:15:00Z'))).resolves.toMatchObject({
      arrivals: 0,
    });
    // 13:15 in Auckland, 105 minutes after the arrival, inside quiet hours set to 0 to 14.
    vi.mocked(listStayingPets).mockResolvedValueOnce([{ ...arrived, quietStart: 0, quietEnd: 14 }]);
    await expect(runDailySummaryPass(new Date('2026-12-12T00:15:00Z'))).resolves.toMatchObject({
      arrivals: 0,
    });
    expect(insertSummary).not.toHaveBeenCalled();
  });

  it('tells the parent about a trend in the same update, and keeps the plan for the note', async () => {
    vi.mocked(listStayingPets).mockResolvedValueOnce([
      { ...BELLA, pickUpAt: new Date('2026-12-15T03:00:00Z') },
    ]);
    const plan = {
      facts: {} as never,
      body: 'note',
      newTrends: ['activity' as const],
      parentLines: [
        'Bella has been less active than usual for 2 days (fewer walks and play sessions); our team is checking in on Bella.',
      ],
    };
    vi.mocked(planMemoryNote).mockReturnValueOnce(plan);

    await runDailySummaryPass(EVENING);

    expect(insertSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'daily',
        body: expect.stringMatching(/ Bella has been less active than usual for 2 days/),
      }),
    );
    expect(writeStayMemoryNote).toHaveBeenCalledWith(
      expect.objectContaining({ bookingPetsUuid: 'bp-1' }),
      '2026-12-13',
      expect.anything(),
      EVENING,
      plan,
    );
  });

  it("writes the day's update once, puts it in the bell and emails it with a Live care link", async () => {
    vi.mocked(listStayingPets).mockResolvedValueOnce([
      { ...BELLA, pickUpAt: new Date('2026-12-15T03:00:00Z') },
    ]);

    await expect(runDailySummaryPass(EVENING)).resolves.toEqual({
      updates: 1,
      reports: 0,
      arrivals: 0,
    });

    expect(findDayTasks).toHaveBeenCalledWith(
      'pet-1',
      BELLA.dropOffAt,
      new Date('2026-12-15T03:00:00Z'),
      '2026-12-13',
    );
    expect(listAdministrationsForDay).toHaveBeenCalledWith('bp-1', '2026-12-13');
    expect(insertSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingPetsUuid: 'bp-1',
        date: '2026-12-13',
        kind: 'daily',
        photoPath: '/tasks/t1/photos/bella.jpg?inline=1',
        body: expect.stringContaining(
          "Here is how Bella's day went on Sun 13 Dec. Bella had the planned meal.",
        ),
      }),
    );
    expect(recordParentNotice).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'owner-1',
        bookingId: 'b-1',
        kind: 'booking_daily_update',
      }),
    );
    expect(sendBookingNoticeEmail).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.stringContaining('/parent/live-care/bp-1') }),
    );
    expect(countCareByDay).not.toHaveBeenCalled();
  });

  it('adds the stay report on the pick-up day, and skips what was already written', async () => {
    vi.mocked(listStayingPets).mockResolvedValueOnce([BELLA]);
    vi.mocked(hasSummary).mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    await expect(runDailySummaryPass(EVENING)).resolves.toEqual({
      updates: 0,
      reports: 1,
      arrivals: 0,
    });

    expect(insertSummary).toHaveBeenCalledTimes(1);
    expect(insertSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'stay_report',
        body: expect.stringContaining(
          'Bella stayed with us for 1 night, from Sat 12 Dec to Sun 13 Dec.',
        ),
      }),
    );
    expect(recordParentNotice).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'booking_stay_report' }),
    );
  });

  it('counts a write only once when another server wrote the same day first', async () => {
    vi.mocked(listStayingPets).mockResolvedValueOnce([
      { ...BELLA, pickUpAt: new Date('2026-12-15T03:00:00Z') },
    ]);
    vi.mocked(insertSummary).mockResolvedValueOnce(null);
    await expect(runDailySummaryPass(EVENING)).resolves.toEqual({
      updates: 0,
      reports: 0,
      arrivals: 0,
    });
    expect(recordParentNotice).not.toHaveBeenCalled();
  });
});

describe('the summaries a parent reads', () => {
  it('are their own stay only', async () => {
    await summariesForOwner('owner-1', 'bp-1');
    expect(listSummariesForStay).toHaveBeenCalledWith('bp-1', expect.anything());

    vi.mocked(findStayById).mockResolvedValueOnce({
      bookingPetId: 'bp-1',
      petOwnersUuid: 'other',
    } as never);
    await expect(summariesForOwner('owner-1', 'bp-1')).rejects.toMatchObject({ statusCode: 404 });
    expect(findBookingRequestSubject).not.toHaveBeenCalled();
  });
});
