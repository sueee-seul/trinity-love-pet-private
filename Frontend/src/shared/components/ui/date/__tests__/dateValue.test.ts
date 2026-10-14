import { describe, expect, it } from 'vitest';
import {
  buildTimeOptions,
  formatDateLabel,
  formatTimeLabel,
  joinDateTime,
  parseIsoDate,
  splitDateTime,
  toDatePart,
  toIsoDate,
} from '../dateValue';

describe('parseIsoDate and toIsoDate', () => {
  it('reads a date as local parts', () => {
    const date = parseIsoDate('2026-10-12');
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(9);
    expect(date?.getDate()).toBe(12);
  });

  it('rejects empty text, bad shapes and days that do not exist', () => {
    expect(parseIsoDate('')).toBeNull();
    expect(parseIsoDate('2026-1-5')).toBeNull();
    expect(parseIsoDate('2026-02-31')).toBeNull();
  });

  it('keeps the calendar day just after and just before midnight', () => {
    expect(toIsoDate(new Date(2026, 9, 12, 0, 5))).toBe('2026-10-12');
    expect(toIsoDate(new Date(2026, 9, 12, 23, 55))).toBe('2026-10-12');
  });
});

describe('formatDateLabel', () => {
  it('writes the English and Chinese trigger text', () => {
    expect(formatDateLabel('2026-10-12', 'en')).toBe('Mon 12 Oct 2026');
    expect(formatDateLabel('2026-10-12', 'zh')).toBe('2026年10月12日 周一');
  });

  it('gives empty text for no date', () => {
    expect(formatDateLabel('', 'en')).toBe('');
  });
});

describe('formatTimeLabel', () => {
  it('writes English times on a 12 hour clock', () => {
    expect(formatTimeLabel('09:00', 'en')).toBe('9:00 am');
    expect(formatTimeLabel('12:30', 'en')).toBe('12:30 pm');
    expect(formatTimeLabel('00:00', 'en')).toBe('12:00 am');
    expect(formatTimeLabel('23:30', 'en')).toBe('11:30 pm');
  });

  it('writes Chinese times with 上午 and 下午', () => {
    expect(formatTimeLabel('09:00', 'zh')).toBe('上午9:00');
    expect(formatTimeLabel('13:30', 'zh')).toBe('下午1:30');
  });

  it('gives empty text for an invalid time', () => {
    expect(formatTimeLabel('24:00', 'en')).toBe('');
  });
});

describe('buildTimeOptions', () => {
  it('covers the whole day in 30 minute steps by default', () => {
    const options = buildTimeOptions({ locale: 'en', stepMinutes: 30, from: '00:00' });
    expect(options).toHaveLength(48);
    expect(options[0]).toEqual({ value: '00:00', label: '12:00 am' });
    expect(options.at(-1)).toEqual({ value: '23:30', label: '11:30 pm' });
  });

  it('keeps an off-grid current value as an extra option in time order', () => {
    const options = buildTimeOptions({
      locale: 'en',
      stepMinutes: 30,
      from: '09:00',
      to: '10:00',
      current: '09:15',
    });
    expect(options.map((option) => option.value)).toEqual(['09:00', '09:15', '09:30', '10:00']);
  });

  it('ignores a current value that is not a time', () => {
    const options = buildTimeOptions({
      locale: 'en',
      stepMinutes: 60,
      from: '09:00',
      to: '10:00',
      current: 'soon',
    });
    expect(options.map((option) => option.value)).toEqual(['09:00', '10:00']);
  });
});

describe('splitDateTime and joinDateTime', () => {
  it('splits and joins a datetime-local value', () => {
    expect(splitDateTime('2026-10-12T09:30')).toEqual({ date: '2026-10-12', time: '09:30' });
    expect(joinDateTime({ date: '2026-10-12', time: '09:30' })).toBe('2026-10-12T09:30');
  });

  it('gives empty parts or an empty value when something is missing', () => {
    expect(splitDateTime('')).toEqual({ date: '', time: '' });
    expect(joinDateTime({ date: '2026-10-12', time: '' })).toBe('');
  });

  it('takes the day part of either bound format', () => {
    expect(toDatePart('2026-10-12T09:30')).toBe('2026-10-12');
    expect(toDatePart('2026-10-12')).toBe('2026-10-12');
    expect(toDatePart(undefined)).toBeUndefined();
  });
});
