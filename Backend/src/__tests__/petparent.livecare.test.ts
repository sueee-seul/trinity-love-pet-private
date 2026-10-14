import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ManagerReviewStatus } from '../contracts/stay-status.contract.js';
import type {
  DayTaskRow,
  StayCandidateRow,
  StayRecord,
} from '../repositories/petparent.livecare.repository.js';

const liveCareRepo = vi.hoisted(() => ({
  findStayCandidatesForOwner: vi.fn(),
  findStayById: vi.fn(),
  findRosterForDate: vi.fn(),
  getTodayInAuckland: vi.fn(),
  findDayTasks: vi.fn(),
}));

vi.mock('../repositories/petparent.livecare.repository.js', () => liveCareRepo);
vi.mock('../config/database.js', () => ({ pool: { query: vi.fn() } }));

const translation = vi.hoisted(() => ({ translateCareNotes: vi.fn() }));
vi.mock('../services/care-note.translation.js', () => translation);

import {
  getLiveCare,
  getStayPetId,
  resolveCurrentBookingPetId,
} from '../services/petparent.livecare.js';

const OWNER = 'owner-1';
const NOW = new Date('2026-09-29T00:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;
const daysFromNow = (days: number): Date => new Date(NOW.getTime() + days * DAY_MS);

const candidate = (
  bookingPetId: string,
  reviewStatus: ManagerReviewStatus,
  from: number,
  to: number,
): StayCandidateRow => ({
  bookingPetId,
  petUuid: `pet-${bookingPetId}`,
  dropOffTime: daysFromNow(from),
  pickUpTime: daysFromNow(to),
  reviewStatus,
});

const stayRecord = (reviewStatus: ManagerReviewStatus): StayRecord => ({
  bookingPetId: 'bp-max',
  petOwnersUuid: OWNER,
  petId: 'pet-max',
  petName: 'Max',
  petPhotoUrl: null,
  dropOffTime: daysFromNow(-1),
  pickUpTime: daysFromNow(2),
  dropOffDate: '2026-09-28',
  pickUpDate: '2026-10-01',
  reviewStatus,
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.clearAllMocks();
  liveCareRepo.getTodayInAuckland.mockResolvedValue('2026-09-29');
  liveCareRepo.findDayTasks.mockResolvedValue([]);
  liveCareRepo.findRosterForDate.mockResolvedValue({ sitterName: null, facilityName: null });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('resolveCurrentBookingPetId', () => {
  it('skips a pending request under way and opens the approved stay instead', async () => {
    liveCareRepo.findStayCandidatesForOwner.mockResolvedValue([
      candidate('bp-pending-now', 'pending', -1, 2),
      candidate('bp-approved-soon', 'approved', 3, 6),
    ]);

    await expect(resolveCurrentBookingPetId(OWNER)).resolves.toBe('bp-approved-soon');
  });

  it('never picks a refused or cancelled stay', async () => {
    liveCareRepo.findStayCandidatesForOwner.mockResolvedValue([
      candidate('bp-refused-now', 'refused', -1, 2),
      candidate('bp-cancelled-now', 'cancelled', -1, 2),
      candidate('bp-approved-ended', 'approved', -10, -6),
    ]);

    await expect(resolveCurrentBookingPetId(OWNER)).resolves.toBe('bp-approved-ended');
  });

  it('finds no stay when the manager has approved none', async () => {
    liveCareRepo.findStayCandidatesForOwner.mockResolvedValue([
      candidate('bp-pending', 'pending', 3, 6),
    ]);

    await expect(resolveCurrentBookingPetId(OWNER)).rejects.toMatchObject({
      statusCode: 404,
      code: 'NO_STAY_FOUND',
    });
  });
});

describe('live care for one stay', () => {
  it.each(['pending', 'refused', 'cancelled'] as const)(
    'answers not found for a %s stay, as for a missing one',
    async (reviewStatus) => {
      liveCareRepo.findStayById.mockResolvedValue(stayRecord(reviewStatus));

      await expect(getLiveCare(OWNER, 'bp-max', undefined)).rejects.toMatchObject({
        statusCode: 404,
        code: 'NO_STAY_FOUND',
      });
      await expect(getStayPetId(OWNER, 'bp-max')).rejects.toMatchObject({ statusCode: 404 });
      expect(liveCareRepo.findDayTasks).not.toHaveBeenCalled();
    },
  );

  it('shows an approved stay', async () => {
    liveCareRepo.findStayById.mockResolvedValue(stayRecord('approved'));

    const data = await getLiveCare(OWNER, 'bp-max', undefined);

    expect(data).toMatchObject({ bookingPetId: 'bp-max', selectedDate: '2026-09-29' });
    await expect(getStayPetId(OWNER, 'bp-max')).resolves.toBe('pet-max');
  });

  // A parent reading Chinese gets each staff note translated beside the original.
  it('adds the Chinese of staff notes only when asked for Chinese', async () => {
    liveCareRepo.findStayById.mockResolvedValue(stayRecord('approved'));
    liveCareRepo.findDayTasks.mockResolvedValue([
      {
        id: 'task-1',
        title: 'Breakfast',
        status: 'completed',
        scheduled_at: new Date('2026-09-29T08:00:00.000Z'),
        description: 'Ate everything.',
        photos: [],
      },
      {
        id: 'task-2',
        title: 'Dinner',
        status: 'upcoming',
        scheduled_at: new Date('2026-09-29T18:00:00.000Z'),
        description: null,
        photos: [],
      },
    ]);
    translation.translateCareNotes.mockResolvedValue(['全部吃完了。']);

    const english = await getLiveCare(OWNER, 'bp-max', undefined);
    expect(translation.translateCareNotes).not.toHaveBeenCalled();
    expect(english.entries[0]).not.toHaveProperty('detailInChinese');

    const chinese = await getLiveCare(OWNER, 'bp-max', undefined, 'zh');
    expect(translation.translateCareNotes).toHaveBeenCalledWith(['Ate everything.']);
    expect(chinese.entries[0]).toMatchObject({
      detail: 'Ate everything.',
      detailInChinese: '全部吃完了。',
    });
    expect(chinese.entries[1]).not.toHaveProperty('detailInChinese');
  });

  // The timeline's photo viewers show images; a task's short video goes out with the day's update.
  it('lists only the photos of a task on the timeline, not its short videos', async () => {
    liveCareRepo.findStayById.mockResolvedValue(stayRecord('approved'));
    liveCareRepo.findDayTasks.mockResolvedValue([
      {
        id: 'task-1',
        title: 'Playtime',
        status: 'completed',
        scheduled_at: new Date('2026-09-29T08:00:00.000Z'),
        description: null,
        photos: [
          { photo_url: 'yard.jpg', caption: null },
          { photo_url: 'yard.mp4', caption: null },
        ],
      },
      {
        id: 'task-2',
        title: 'Outdoor Walk',
        status: 'completed',
        scheduled_at: new Date('2026-09-29T09:00:00.000Z'),
        description: null,
        photos: [{ photo_url: 'walk.mov', caption: null }],
      },
    ]);

    const { entries } = await getLiveCare(OWNER, 'bp-max', undefined);

    expect(entries[0]?.photos).toEqual(['/tasks/task-1/photos/yard.jpg?inline=1']);
    expect(entries[1]).not.toHaveProperty('photos');
  });

  // The parent's page reads each task the way the staff task pages do.
  describe('in step with the staff task pages', () => {
    const task = (id: string, title: string, status: string, scheduledAt: string): DayTaskRow => ({
      id,
      title,
      status,
      scheduled_at: new Date(scheduledAt),
      description: null,
      photos: [],
    });

    it('shows a task staff have started as in progress, and an overdue one as upcoming', async () => {
      liveCareRepo.findStayById.mockResolvedValue(stayRecord('approved'));
      liveCareRepo.findDayTasks.mockResolvedValue([
        task('t-1', 'Feeding (morning)', 'in_progress', '2026-09-29T08:00:00.000Z'),
        task('t-2', 'Outdoor Walk', 'pending', '2026-09-29T10:30:00.000Z'),
      ]);

      const { entries } = await getLiveCare(OWNER, 'bp-max', undefined);

      expect(entries.map((entry) => entry.status)).toEqual(['in_progress', 'upcoming']);
    });

    it('gives a task still at midnight no time, and lists it after the timed ones', async () => {
      liveCareRepo.findStayById.mockResolvedValue(stayRecord('approved'));
      liveCareRepo.findDayTasks.mockResolvedValue([
        task('t-groom', 'Grooming', 'pending', '2026-09-29T00:00:00.000Z'),
        task('t-dinner', 'Feeding (evening)', 'pending', '2026-09-29T19:00:00.000Z'),
      ]);

      const { entries } = await getLiveCare(OWNER, 'bp-max', undefined);

      expect(entries.map((entry) => [entry.id, entry.time])).toEqual([
        ['t-dinner', '7:00 PM'],
        ['t-groom', null],
      ]);
    });

    it('leaves out a stat the day has nothing planned for', async () => {
      liveCareRepo.findStayById.mockResolvedValue(stayRecord('approved'));
      liveCareRepo.findDayTasks.mockResolvedValue([
        task('t-1', 'Feeding (morning)', 'completed', '2026-09-29T08:00:00.000Z'),
      ]);

      const { stats } = await getLiveCare(OWNER, 'bp-max', undefined);

      expect(stats).toEqual([
        { label: 'Meals & Meds', value: '1/1' },
        { label: 'Photos Shared', value: '0' },
      ]);
    });

    it('names no carer or place when nobody is rostered onto the pet', async () => {
      liveCareRepo.findStayById.mockResolvedValue(stayRecord('approved'));
      liveCareRepo.findRosterForDate.mockResolvedValue({
        sitterName: null,
        facilityName: 'Ponsonby',
      });

      const data = await getLiveCare(OWNER, 'bp-max', undefined);

      expect(data).toMatchObject({ sitterName: null, location: null });
    });
  });
});
