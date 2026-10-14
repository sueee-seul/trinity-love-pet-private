import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DoseRecord } from '../contracts/medication.contract.js';
import {
  insertMemoryNote,
  listMemoryNotes,
  type StayMemoryFacts,
  type StoredMemoryNote,
} from '../repositories/stay-memory.repository.js';
import { weightIn, type DayFacts } from '../services/daily-summary.compose.js';
import { raiseEscalation } from '../services/escalation.service.js';
import {
  composeMemoryNote,
  planMemoryNote,
  writeStayMemoryNote,
} from '../services/stay-memory.service.js';

vi.mock('../config/database.js', () => ({ pool: { query: vi.fn() } }));
vi.mock('../repositories/stay-memory.repository.js', () => ({
  insertMemoryNote: vi.fn(async (note: Record<string, unknown>) => ({
    id: 'n1',
    bookingPetId: note.bookingPetsUuid,
    date: note.date,
    locale: note.locale,
    body: note.body,
    facts: note.facts,
    generatedAt: new Date('2026-12-13T04:10:00Z'),
  })),
  listMemoryNotes: vi.fn(async () => []),
}));
vi.mock('../services/escalation.service.js', () => ({
  raiseEscalation: vi.fn(async () => undefined),
}));

const facts = (overrides: Partial<StayMemoryFacts> = {}): StayMemoryFacts => ({
  dayNumber: 2,
  feedsDone: 2,
  feedsPlanned: 2,
  walks: 1,
  play: 1,
  dosesGiven: 1,
  dosesPlanned: 1,
  dosesNotGiven: 0,
  photos: 3,
  appetiteDownStreak: 0,
  ...overrides,
});

const dose = (status: DoseRecord['status']): DoseRecord => ({
  id: 'd',
  medicationId: 'm',
  medicineName: 'Apoquel',
  dose: 1,
  unit: 'tablet',
  slot: 'evening',
  dueAt: '2026-12-13T05:00:00.000Z',
  status,
  givenAt: null,
  givenBy: null,
  reason: null,
});

const dayFacts = (overrides: Partial<DayFacts> = {}): DayFacts => ({
  petName: 'Bella',
  dayLabel: 'Sun 13 Dec',
  feedsDone: 1,
  feedsPlanned: 2,
  walksDone: 1,
  playDone: 0,
  otherDone: [],
  photos: 2,
  videos: 0,
  weightKg: null,
  toiletDone: 0,
  doses: [dose('given')],
  notes: ['Quiet after lunch, happy at the 3 pm walk.'],
  ...overrides,
});

/** Bella: dropped off Fri 11 Dec 10:30, picked up Sun 13 Dec 16:00, Auckland. */
const BELLA = {
  bookingPetsUuid: 'bp-1',
  bookingId: 'b-1',
  ownerId: 'owner-1',
  petUuid: 'pet-1',
  petName: 'Bella',
  dropOffAt: new Date('2026-12-10T21:30:00Z'),
  pickUpAt: new Date('2026-12-13T03:00:00Z'),
  checkInRecordedAt: new Date('2026-12-10T21:40:00Z'),
  locale: 'en' as const,
  digestHour: 17,
  quietStart: 22,
  quietEnd: 7,
  emailUpdates: true,
};

const NOW = new Date('2026-12-13T04:10:00Z');

const storedNote = (noteFacts: StayMemoryFacts): StoredMemoryNote => ({
  id: 'n0',
  bookingPetId: 'bp-1',
  date: '2026-12-12',
  locale: 'en',
  body: 'yesterday',
  facts: noteFacts,
  generatedAt: new Date('2026-12-12T04:10:00Z'),
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listMemoryNotes).mockResolvedValue([]);
});

describe('the memory note', () => {
  it('reads as a day in the stay, with appetite, activity, medication, notes and photos', () => {
    expect(
      composeMemoryNote(
        {
          petName: 'Bella',
          dayLabel: 'Sun 13 Dec',
          totalNights: 2,
          facts: facts(),
          previous: null,
        },
        ['Quiet after lunch.'],
        'en',
      ),
    ).toBe(
      'Day 2 of Bella\'s 2-night stay (Sun 13 Dec). Appetite: ate every planned meal. Activity: 1 walk, 1 play session. Medication: 1 of 1 doses given. Staff noted: "Quiet after lunch." 3 photos taken.',
    );
  });

  it('compares appetite with the day before and says when staff were asked to look', () => {
    const less = composeMemoryNote(
      {
        petName: 'Bella',
        dayLabel: 'Sun 13 Dec',
        totalNights: 3,
        facts: facts({ feedsDone: 1, appetiteDownStreak: 1 }),
        previous: facts(),
      },
      [],
      'en',
    );
    expect(less).toContain('Appetite: ate 1 of 2 planned meals. That is less than the day before.');
    expect(less).not.toContain('Watch:');

    const watch = composeMemoryNote(
      {
        petName: 'Bella',
        dayLabel: 'Mon 14 Dec',
        totalNights: 3,
        facts: facts({ feedsDone: 1, appetiteDownStreak: 2 }),
        previous: facts({ feedsDone: 1, appetiteDownStreak: 1 }),
      },
      [],
      'en',
    );
    expect(watch).toContain('Watch: appetite down for 2 days; staff have been asked to look.');
    expect(watch).not.toContain('less than the day before');
  });

  it('is written in Chinese for a Chinese parent, with no dash in either language', () => {
    const zh = composeMemoryNote(
      {
        petName: 'Bella',
        dayLabel: '12月13日（周日）',
        totalNights: 2,
        facts: facts({ feedsDone: 1, appetiteDownStreak: 1 }),
        previous: facts(),
      },
      ['午饭后很安静。'],
      'zh',
    );
    expect(zh).toBe(
      'Bella这次住2晚，今天是第2天（12月13日（周日））。食欲：计划2餐吃了1餐。比前一天少。活动：1次散步，1次玩耍。用药：计划1剂给了1剂。工作人员备注：“午饭后很安静。”拍了3张照片。',
    );
    expect(zh).not.toMatch(/[–—]/);
  });
});

describe('writing the day’s note', () => {
  it('counts the day of the stay, carries the appetite streak from yesterday, and stores the facts', async () => {
    vi.mocked(listMemoryNotes).mockResolvedValueOnce([
      storedNote(facts({ dayNumber: 2, feedsDone: 1, appetiteDownStreak: 1 })),
    ]);
    const note = await writeStayMemoryNote(BELLA, '2026-12-13', dayFacts(), NOW);
    expect(note?.facts).toMatchObject({
      dayNumber: 3,
      feedsDone: 1,
      feedsPlanned: 2,
      appetiteDownStreak: 2,
      dosesGiven: 1,
      photos: 2,
    });
    expect(note?.body).toContain("Day 3 of Bella's 2-night stay");
    expect(note?.body).toContain('Watch: appetite down for 2 days');
    // The watch mark reached today: staff are asked once, as a normal escalation.
    expect(raiseEscalation).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: 'b-1',
        source: 'behaviour_trend',
        severity: 'normal',
        summary: expect.stringContaining('eaten less than planned for 2 days'),
      }),
      NOW,
    );
  });

  it('resets the streak when the pet ate everything, and asks nobody', async () => {
    vi.mocked(listMemoryNotes).mockResolvedValueOnce([
      storedNote(facts({ feedsDone: 1, appetiteDownStreak: 1 })),
    ]);
    const note = await writeStayMemoryNote(
      BELLA,
      '2026-12-13',
      dayFacts({ feedsDone: 2, feedsPlanned: 2 }),
      NOW,
    );
    expect(note?.facts.appetiteDownStreak).toBe(0);
    expect(note?.body).toContain('Better than the day before.');
    expect(raiseEscalation).not.toHaveBeenCalled();
  });

  it('does not ask staff again on the third day of the same streak', async () => {
    vi.mocked(listMemoryNotes).mockResolvedValueOnce([
      storedNote(facts({ feedsDone: 1, appetiteDownStreak: 2 })),
    ]);
    const note = await writeStayMemoryNote(BELLA, '2026-12-13', dayFacts(), NOW);
    expect(note?.facts.appetiteDownStreak).toBe(3);
    expect(raiseEscalation).not.toHaveBeenCalled();
    expect(insertMemoryNote).toHaveBeenCalledWith(
      expect.objectContaining({ bookingPetsUuid: 'bp-1', date: '2026-12-13', locale: 'en' }),
    );
  });
});

describe('trends across the stay (stretch goal 2)', () => {
  const previousFacts = (overrides: Partial<StayMemoryFacts> = {}): StayMemoryFacts => ({
    dayNumber: 2,
    feedsDone: 2,
    feedsPlanned: 2,
    walks: 2,
    play: 2,
    dosesGiven: 0,
    dosesPlanned: 0,
    dosesNotGiven: 0,
    photos: 1,
    appetiteDownStreak: 0,
    ...overrides,
  });

  it('counts days of less activity and tells staff and the parent on the second day', () => {
    const first = planMemoryNote(
      BELLA,
      '2026-12-12',
      dayFacts({ feedsDone: 2, walksDone: 1, playDone: 1 }),
      previousFacts(),
    );
    expect(first.facts.activityDownStreak).toBe(1);
    expect(first.newTrends).toEqual([]);

    const second = planMemoryNote(
      BELLA,
      '2026-12-13',
      dayFacts({ feedsDone: 2, walksDone: 1, playDone: 1 }),
      first.facts,
    );
    expect(second.facts.activityDownStreak).toBe(2);
    expect(second.newTrends).toEqual(['activity']);
    expect(second.parentLines).toEqual([
      'Bella has been less active than usual for 2 days (fewer walks and play sessions); our team is checking in on Bella.',
    ]);
    expect(second.body).toContain('Watch: less active for 2 days');
  });

  it('flags a 5% weight change from the first weight of the stay, once', () => {
    const start = planMemoryNote(
      BELLA,
      '2026-12-11',
      dayFacts({ feedsDone: 2, weightKg: 12.8 }),
      null,
    );
    expect(start.facts.baselineWeightKg).toBe(12.8);

    const lighter = planMemoryNote(
      BELLA,
      '2026-12-12',
      dayFacts({ feedsDone: 2, weightKg: 12.0 }),
      start.facts,
    );
    expect(lighter.newTrends).toEqual(['weight']);
    expect(lighter.parentLines).toEqual([
      'Bella weighed 12 kg today, 6.3% less than the 12.8 kg at the start of the stay; our team is keeping an eye on it.',
    ]);

    const still = planMemoryNote(
      BELLA,
      '2026-12-13',
      dayFacts({ feedsDone: 2, weightKg: 11.9 }),
      lighter.facts,
    );
    expect(still.newTrends).toEqual([]);
    expect(still.parentLines).toHaveLength(1);
  });

  it('tells a parent who reads Chinese in Chinese', () => {
    const plan = planMemoryNote(
      { ...BELLA, locale: 'zh' },
      '2026-12-13',
      dayFacts({ feedsDone: 0, feedsPlanned: 2 }),
      previousFacts({ feedsDone: 1, appetiteDownStreak: 1 }),
    );
    expect(plan.parentLines[0]).toBe('Bella已经连续2天吃得比计划少，工作人员正在密切留意。');
  });

  it('raises one escalation for each trend that reaches its mark', async () => {
    const plan = planMemoryNote(
      BELLA,
      '2026-12-13',
      dayFacts({ feedsDone: 2, walksDone: 0, playDone: 0, weightKg: 11 }),
      previousFacts({ activityDownStreak: 1, walks: 1, play: 0, weightKg: 12.8 }),
    );
    await writeStayMemoryNote(BELLA, '2026-12-13', dayFacts(), new Date(), plan);

    expect(plan.newTrends).toEqual(['activity', 'weight']);
    expect(raiseEscalation).toHaveBeenCalledTimes(2);
  });
});

describe('weightIn', () => {
  it.each([
    ['12.4 kg', 12.4],
    ['Weighed 9kg this morning', 9],
    ['体重12.5公斤', 12.5],
    ['no weight here', null],
  ])('%s', (text, kg) => {
    expect(weightIn(text)).toBe(kg);
  });
});
