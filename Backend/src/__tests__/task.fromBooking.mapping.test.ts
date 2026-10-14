import { describe, expect, it } from 'vitest';
import { buildTaskSpecs, type BookingTaskInputRow } from '../services/task.fromBooking.mapping.js';

const stay = (overrides: Partial<BookingTaskInputRow> = {}): BookingTaskInputRow => ({
  pet_id: 'pet-1',
  drop_off_date: '2026-10-05',
  pick_up_date: '2026-10-07',
  feeding_routine: null,
  medication_instructions: null,
  services: [],
  ...overrides,
});

const timesOf = (title: string, row: BookingTaskInputRow): (string | null)[] =>
  buildTaskSpecs(row)
    .filter((spec) => spec.title === title)
    .map((spec) => spec.scheduledAt);

describe('buildTaskSpecs times', () => {
  it('feeds at 8:00 and 19:00 on every night of the stay', () => {
    expect(timesOf('Feeding (morning)', stay())).toEqual([
      '2026-10-05T08:00:00Z',
      '2026-10-06T08:00:00Z',
    ]);
    expect(timesOf('Feeding (evening)', stay())).toEqual([
      '2026-10-05T19:00:00Z',
      '2026-10-06T19:00:00Z',
    ]);
  });

  it('gives each paid daily service its own time, at least 30 minutes from breakfast', () => {
    const row = stay({
      medication_instructions: 'Half a tablet',
      services: [
        { name: 'Extra playtime', category: 'addon', price_unit: 'per day' },
        { name: 'Outdoor walk', category: 'addon', price_unit: 'per day' },
      ],
    });

    expect(timesOf('Medication Administration', row)[0]).toBe('2026-10-05T08:30:00Z');
    expect(timesOf('Outdoor Walk', row)[0]).toBe('2026-10-05T10:30:00Z');
    expect(timesOf('Extra Playtime', row)[0]).toBe('2026-10-05T16:00:00Z');
  });

  it('leaves grooming on its day with no time, for the manager to set', () => {
    const row = stay({
      services: [{ name: 'Grooming', category: 'addon', price_unit: 'per stay' }],
    });

    expect(timesOf('Grooming', row)).toEqual(['2026-10-06']);
  });

  it('has no time at all when the stay has no drop-off date', () => {
    expect(timesOf('Feeding (morning)', stay({ drop_off_date: null }))).toEqual([null]);
  });
});
