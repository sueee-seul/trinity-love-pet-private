import { describe, expect, it } from 'vitest';
import {
  formatInquiryDayLabel,
  formatInquiryTime,
  inquiryIsoAt,
  toInquiryCalendarDate,
  todayInquiryCalendarDate,
} from '../inquiryTime';

describe('formatInquiryTime', () => {
  it('renders an ISO timestamp as h:mm AM/PM', () => {
    expect(formatInquiryTime(inquiryIsoAt(9, 5))).toBe('9:05 AM');
    expect(formatInquiryTime(inquiryIsoAt(14, 30))).toBe('2:30 PM');
  });
});

describe('formatInquiryDayLabel', () => {
  it('returns "Today" for a timestamp on today\'s date', () => {
    expect(formatInquiryDayLabel(inquiryIsoAt(10, 0))).toBe('Today');
  });

  it('returns a short date label for an earlier date', () => {
    const iso = inquiryIsoAt(10, 0, 3);
    const expected = new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    expect(formatInquiryDayLabel(iso)).toBe(expected);
  });
});

describe('inquiryIsoAt', () => {
  it('sets the local hour/minute and offsets the date backward by daysAgo', () => {
    const iso = inquiryIsoAt(13, 45, 2);
    const date = new Date(iso);
    expect(date.getHours()).toBe(13);
    expect(date.getMinutes()).toBe(45);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(iso);
    target.setHours(0, 0, 0, 0);
    const diffDays = Math.round((today.getTime() - target.getTime()) / (24 * 60 * 60 * 1000));
    expect(diffDays).toBe(2);
  });
});

describe('toInquiryCalendarDate', () => {
  it('formats an ISO timestamp as local YYYY-MM-DD', () => {
    const date = new Date();
    date.setMonth(0, 5); // Jan 5th, single-digit month and day
    date.setHours(10, 0, 0, 0);
    const year = date.getFullYear();

    expect(toInquiryCalendarDate(date.toISOString())).toBe(`${year}-01-05`);
  });

  it('zero-pads single-digit months and days', () => {
    const result = toInquiryCalendarDate(inquiryIsoAt(10, 0));
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('todayInquiryCalendarDate', () => {
  it('matches toInquiryCalendarDate(new Date().toISOString())', () => {
    expect(todayInquiryCalendarDate()).toBe(toInquiryCalendarDate(new Date().toISOString()));
  });
});
