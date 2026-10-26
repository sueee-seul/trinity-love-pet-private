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
  it('feeds twice on every night of the stay, with no time for the manager to set', () => {
    expect(timesOf('Feeding (morning)', stay())).toEqual(['2026-10-05', '2026-10-06']);
    expect(timesOf('Feeding (evening)', stay())).toEqual(['2026-10-05', '2026-10-06']);
  });

  it('leaves each paid daily service on its day with no time, for the manager to set', () => {
    const row = stay({
      medication_instructions: 'Half a tablet',
      services: [
        { name: 'Extra playtime', category: 'addon', price_unit: 'per day' },
        { name: 'Outdoor walk', category: 'addon', price_unit: 'per day' },
      ],
    });

    expect(timesOf('Medication Administration', row)[0]).toBe('2026-10-05');
    expect(timesOf('Outdoor Walk', row)[0]).toBe('2026-10-05');
    expect(timesOf('Extra Playtime', row)[0]).toBe('2026-10-05');
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
