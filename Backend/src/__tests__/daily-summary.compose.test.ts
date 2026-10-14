import { describe, expect, it } from 'vitest';
import type { DoseRecord } from '../contracts/medication.contract.js';
import type { DayTaskRow } from '../repositories/petparent.livecare.repository.js';
import {
  composeArrivalNote,
  composeDailyUpdate,
  composeStayReport,
  dayLabelOf,
  factsFromDay,
  medicationSentence,
} from '../services/daily-summary.compose.js';

const task = (
  title: string,
  status: string,
  photos = 0,
  description: string | null = null,
  videos = 0,
): DayTaskRow => ({
  id: `task-${title}`,
  title,
  status,
  scheduled_at: new Date('2026-12-13T08:00:00Z'),
  description,
  photos: [
    ...Array.from({ length: photos }, (_, index) => ({
      photo_url: `p${index}.jpg`,
      caption: null,
    })),
    ...Array.from({ length: videos }, (_, index) => ({
      photo_url: `v${index}.mp4`,
      caption: null,
    })),
  ],
});

const dose = (overrides: Partial<DoseRecord>): DoseRecord => ({
  id: 'd',
  medicationId: 'm',
  medicineName: 'Apoquel',
  dose: 1,
  unit: 'tablet',
  slot: 'evening',
  dueAt: '2026-12-13T05:00:00.000Z',
  status: 'due',
  givenAt: null,
  givenBy: null,
  reason: null,
  ...overrides,
});

describe("the day's update", () => {
  it('reads the day from the records: meals, exercise, medicine, notes and photos', () => {
    const facts = factsFromDay(
      'Bella',
      'Sun 13 Dec',
      [
        task('Feeding (morning)', 'completed', 1, 'Ate everything'),
        task('Feeding (evening)', 'completed'),
        task('Outdoor Walk', 'completed', 2),
        task('Extra Playtime (add-on)', 'pending'),
        task('Grooming (add-on)', 'completed'),
        task('Give Apoquel 1 tablet (evening)', 'completed'),
      ],
      [dose({ status: 'given', givenAt: '2026-12-13T05:05:00.000Z', givenBy: 'Sam' })],
    );

    expect(composeDailyUpdate(facts)).toBe(
      "Here is how Bella's day went on Sun 13 Dec. Bella had all 2 planned meals. Today's care included 1 walk and grooming. Bella had Apoquel (evening) at 6:05 pm. Staff note: Ate everything 3 photos were taken today; you can see them on Live care.",
    );
  });

  it('says plainly when little is recorded yet, and never calls an unticked dose given', () => {
    const facts = factsFromDay(
      'Bella',
      'Sun 13 Dec',
      [task('Feeding (morning)', 'completed'), task('Feeding (evening)', 'pending')],
      [
        dose({ slot: 'morning', status: 'overdue', dueAt: '2026-12-12T19:00:00.000Z' }),
        dose({ status: 'due' }),
      ],
    );
    expect(composeDailyUpdate(facts)).toBe(
      "Here is how Bella's day went on Sun 13 Dec. Bella has had 1 of 2 planned meals so far. 2 doses are not yet recorded as given; staff have been alerted about the overdue one.",
    );
    expect(composeDailyUpdate(factsFromDay('Bella', 'Sun 13 Dec', [], []))).toBe(
      "Here is how Bella's day went on Sun 13 Dec. Nothing has been recorded for Bella yet today; the team will add care as the day goes on.",
    );
  });

  it('names a dose that staff recorded as not given, with their reason', () => {
    expect(
      medicationSentence('Bella', [
        dose({ status: 'not_given', reason: 'Refused the tablet twice' }),
        dose({ slot: 'morning', status: 'given', givenAt: '2026-12-12T19:10:00.000Z' }),
      ]),
    ).toBe(
      'Bella had Apoquel (morning) at 8:10 am. The evening Apoquel was not given: Refused the tablet twice.',
    );
    expect(medicationSentence('Bella', [])).toBeNull();
  });

  it('labels an Auckland day', () => {
    expect(dayLabelOf(new Date('2026-12-12T22:00:00Z'))).toBe('Sun 13 Dec');
  });
});

describe('the stay report', () => {
  it('sums the stay and points the parent to the vet when a dose has no record', () => {
    expect(
      composeStayReport({
        petName: 'Bella',
        nights: 3,
        firstDay: 'Sat 12 Dec',
        lastDay: 'Tue 15 Dec',
        days: [
          { day: '2026-12-12', feedsDone: 1, feedsPlanned: 1, walks: 1, play: 0, photos: 2 },
          { day: '2026-12-13', feedsDone: 2, feedsPlanned: 2, walks: 1, play: 1, photos: 3 },
          { day: '2026-12-14', feedsDone: 1, feedsPlanned: 2, walks: 0, play: 0, photos: 0 },
        ],
        dosesGiven: 4,
        dosesPlanned: 6,
        dosesNotGiven: 1,
      }),
    ).toBe(
      'Bella stayed with us for 3 nights, from Sat 12 Dec to Tue 15 Dec. 4 of 5 planned meals were recorded as given. Exercise: 2 walks and 1 play session. Medication: 4 of 6 doses recorded as given, 1 recorded as not given, 1 without a record. Please share this with your vet if anything was missed. 5 photos were taken during the stay; they stay on Live care.',
    );
  });
});

describe('the same update in Chinese', () => {
  // 5 pm on Sun 13 Dec in Auckland (NZDT, UTC+13).
  const sunday = new Date('2026-12-13T04:00:00Z');

  it('labels the day and the time the Chinese way', () => {
    expect(dayLabelOf(sunday, 'zh')).toBe('12月13日（周日）');
    expect(dayLabelOf(sunday)).toBe('Sun 13 Dec');
  });

  it('writes meals, exercise, medicine, notes and photos in Chinese, from the same records', () => {
    const facts = factsFromDay(
      'Bella',
      dayLabelOf(sunday, 'zh'),
      [
        task('Feeding (morning)', 'completed'),
        task('Feeding (evening)', 'completed', 0, 'Ate slowly but finished.'),
        task('Outdoor Walk', 'completed', 2),
        task('Grooming (add-on)', 'completed'),
      ],
      [
        dose({ status: 'given', givenAt: '2026-12-13T05:05:00.000Z' }),
        dose({ id: 'd2', slot: 'morning', status: 'not_given', reason: 'Refused the tablet' }),
      ],
    );
    const text = composeDailyUpdate(facts, 'zh');
    expect(text).toBe(
      '这是Bella12月13日（周日）的情况。Bella吃完了计划的2餐。今天的照护包括1次散步、美容。' +
        'Bella已服用Apoquel（晚上，下午6:05）。早上的Apoquel没有给，原因：Refused the tablet。' +
        '工作人员备注：Ate slowly but finished.今天拍了2张照片，可以在“照顾动态”里查看。',
    );
  });

  it('says when little is recorded, and that an unrecorded dose is not given', () => {
    const facts = factsFromDay('Bella', '12月13日（周日）', [], [dose({ status: 'overdue' })]);
    expect(composeDailyUpdate(facts, 'zh')).toBe(
      '这是Bella12月13日（周日）的情况。还有1剂今天尚未记录为已给；工作人员已收到逾期提醒。',
    );
    expect(medicationSentence('Bella', [dose({ status: 'due' })], 'zh')).toBe(
      '今天还有1剂稍后要给。',
    );
  });

  it('writes the stay report in Chinese and points to the vet when a dose has no record', () => {
    expect(
      composeStayReport(
        {
          petName: 'Bella',
          nights: 2,
          firstDay: '12月11日（周五）',
          lastDay: '12月13日（周日）',
          days: [
            { day: '2026-12-12', feedsDone: 2, feedsPlanned: 2, walks: 1, play: 1, photos: 2 },
            { day: '2026-12-13', feedsDone: 1, feedsPlanned: 2, walks: 1, play: 0, photos: 0 },
          ],
          dosesGiven: 3,
          dosesPlanned: 4,
          dosesNotGiven: 0,
        },
        'zh',
      ),
    ).toBe(
      'Bella在我们这里住了2晚，从12月11日（周五）到12月13日（周日）。计划4餐中有3餐记录为已给。' +
        '运动：2次散步和1次玩耍。用药：计划4剂中有3剂记录为已给，1剂没有记录。如有遗漏，请把这份报告给你的兽医看。' +
        '住宿期间拍了2张照片，都保存在“照顾动态”里。',
    );
  });

  it('writes the arrival note in both languages, naming the hour the full update comes', () => {
    expect(composeArrivalNote('Bella', 'photo', 17)).toBe(
      'Bella has arrived and is settling in with us. The first photo is on Live care. You will get the full update at 5 pm.',
    );
    expect(composeArrivalNote('Bella', null, 9, 'zh')).toBe(
      'Bella已经到了，正在熟悉环境。今天上午9点会有完整的动态。',
    );
    expect(composeArrivalNote('Bella', null, 12, 'en')).toContain('at 12 pm');
  });

  it('names a short video instead of a photo when the arrival note carries one', () => {
    expect(composeArrivalNote('Bella', 'video', 17)).toBe(
      'Bella has arrived and is settling in with us. A short video from today is on Live care. You will get the full update at 5 pm.',
    );
    expect(composeArrivalNote('Bella', 'video', 17, 'zh')).toBe(
      'Bella已经到了，正在熟悉环境。今天的一段短视频已经在“照顾动态”里。今天下午5点会有完整的动态。',
    );
  });

  it('counts photos and short videos apart, and names the video in both languages', () => {
    const facts = factsFromDay(
      'Bella',
      'Sun 13 Dec',
      [task('Playtime', 'completed', 0, null, 1)],
      [],
    );
    expect(facts.photos).toBe(0);
    expect(facts.videos).toBe(1);
    const english = composeDailyUpdate(facts);
    expect(english).toContain(
      'There is a short video of Bella from today with this update on Live care.',
    );
    expect(english).not.toContain('photo');
    expect(composeDailyUpdate(facts, 'zh')).toContain(
      '今天Bella的一段短视频和这条动态一起放在“照顾动态”里。',
    );
  });

  it('says both when the day has photos and a short video', () => {
    const facts = factsFromDay('Bella', 'Sun 13 Dec', [task('Walk', 'completed', 2, null, 1)], []);
    expect(composeDailyUpdate(facts)).toContain(
      '2 photos were taken today; you can see them on Live care. There is a short video of Bella',
    );
  });

  it('never uses an em dash or an en dash in either language', () => {
    const facts = factsFromDay('Bella', 'x', [task('Feeding', 'completed', 1)], [dose({})]);
    for (const locale of ['en', 'zh'] as const) {
      expect(composeDailyUpdate(facts, locale)).not.toMatch(/[\u2013\u2014]/);
    }
  });
});

describe('toileting and weight checks in the day', () => {
  it('counts toilet breaks and names the weight check, in both languages', () => {
    const tasks = [
      task('Feeding', 'completed'),
      task('Toilet break', 'completed'),
      task('Potty walk', 'completed'),
      task('Weight check', 'completed', 0, '12.4 kg'),
    ];
    const facts = factsFromDay('Bella', 'Sun 13 Dec', tasks, []);

    expect(facts).toMatchObject({ toiletDone: 2, weightKg: 12.4 });
    expect(facts.otherDone).toEqual([]);
    expect(composeDailyUpdate(facts)).toContain(
      "Bella had 2 toilet breaks. Bella weighed 12.4 kg at today's weight check.",
    );
    expect(composeDailyUpdate({ ...facts, dayLabel: '12月13日（周日）' }, 'zh')).toContain(
      'Bella今天如厕2次。今天称重，Bella体重12.4公斤。',
    );
  });
});
