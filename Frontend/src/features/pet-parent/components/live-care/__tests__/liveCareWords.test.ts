import { describe, expect, it } from 'vitest';
import type { LiveCareData } from '../../../types/liveCare';
import { clockText, liveCareIn, taskTitleText } from '../liveCareWords';

const DAY: LiveCareData = {
  bookingPetId: 'bp-1',
  petId: 'pet-1',
  petName: 'Biscuit',
  sitterName: 'Sam',
  location: 'Ponsonby',
  dropOffDate: '2026-10-12',
  pickUpDate: '2026-10-15',
  availableDates: ['2026-10-12'],
  selectedDate: '2026-10-12',
  entries: [
    {
      id: 't-1',
      time: '8:00 AM',
      title: 'Morning Potty Break',
      category: 'potty',
      icon: '🐕',
      status: 'completed',
      detail: 'All good.',
    },
    {
      id: 't-2',
      time: null,
      title: 'Grooming',
      category: 'other',
      icon: '📝',
      status: 'upcoming',
    },
  ],
  stats: [{ label: 'Meals & Meds', value: '1/2' }],
};

describe('live care words', () => {
  it('names known tasks in Chinese whatever their case, and keeps a medicine name', () => {
    expect(taskTitleText('Wellness check', 'other')).toBe('健康检查');
    expect(taskTitleText('Medication: Carprofen', 'meal')).toBe('用药：Carprofen');
  });

  it('shows a task staff named themselves as its kind of care', () => {
    expect(taskTitleText('Cuddles on the sofa', 'solo')).toBe('独处活动');
  });

  it('writes the time of day in Chinese', () => {
    expect(clockText('9:05 AM')).toBe('上午 9:05');
    expect(clockText('12:30 PM')).toBe('下午 12:30');
    expect(clockText('soon')).toBe('soon');
  });

  it('turns a whole day into Chinese and leaves English and staff notes alone', () => {
    const chinese = liveCareIn(DAY, 'zh');

    expect(chinese.sitterName).toBe('Sam');
    expect(chinese.entries[0]).toMatchObject({
      title: '早上如厕',
      time: '上午 8:00',
      detail: 'All good.',
    });
    // A task with no time yet keeps none; the page words it.
    expect(chinese.entries[1]).toMatchObject({ title: '美容', time: null });
    expect(chinese.stats[0]).toEqual({ label: '用餐和用药', value: '1/2' });
    expect(liveCareIn(DAY, 'en')).toBe(DAY);
  });
});
