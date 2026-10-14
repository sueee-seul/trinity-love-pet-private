import { describe, expect, it } from 'vitest';
import { selectFeedbackList } from '../feedbackSelectors';
import type { AdminFeedback } from '../../types/feedback';
import {
  formatFeedbackCalendarDate,
  toFeedbackCalendarDayTimestamp,
} from '../../utils/feedbackTime';

const createFeedback = (overrides: Partial<AdminFeedback>): AdminFeedback => ({
  uuid: 'feedback-1',
  initials: 'AM',
  parentName: 'Ava Mitchell',
  petName: 'Biscuit',
  date: 'Aug 24, 2026',
  timestamp: Date.parse('2026-08-24T00:00:00Z'),
  serviceType: '',
  rating: 3.4,
  aiSummary: 'The parent suggested showing individual pet images.',
  category: 'Suggestion',
  is_read: false,
  assigneeId: null,
  current_status: 'submitted',
  answers: ['The parent suggested showing individual pet images.'],
  timeline: [{ step: 'submitted', timestamp: 'Aug 24, 2026', actor: 'System' }],
  ...overrides,
});

const defaultOptions = {
  searchQuery: '',
  statusFilter: 'all' as const,
  typeFilter: 'All' as const,
  sortOption: 'newest' as const,
  timeRange: 'all' as const,
  ratingMin: 1,
  ratingMax: 5,
  dateFrom: '',
  dateTo: '',
};

describe('feedbackSelectors', () => {
  it('filters by parent, pet, summary, and answer text', () => {
    const feedbacks = [
      createFeedback({ uuid: 'feedback-1' }),
      createFeedback({
        uuid: 'feedback-2',
        parentName: 'Ben Smith',
        petName: 'Milo',
        aiSummary: 'A positive daycare experience.',
        answers: ['Please add more individual photos.'],
      }),
    ];

    expect(
      selectFeedbackList(feedbacks, { ...defaultOptions, searchQuery: 'individual photos' }).map(
        (feedback) => feedback.uuid,
      ),
    ).toEqual(['feedback-2']);
  });

  it('applies type, read, rating, and deterministic sort filters', () => {
    const feedbacks = [
      createFeedback({ uuid: 'feedback-1', category: 'Suggestion', rating: 4.2 }),
      createFeedback({ uuid: 'feedback-2', category: 'Issue', rating: 2.1, is_read: true }),
      createFeedback({ uuid: 'feedback-3', category: 'Suggestion', rating: 4.8 }),
    ];

    expect(
      selectFeedbackList(feedbacks, {
        ...defaultOptions,
        typeFilter: 'Suggestion',
        statusFilter: 'unread',
        ratingMin: 4,
        sortOption: 'highest',
      }).map((feedback) => feedback.uuid),
    ).toEqual(['feedback-3', 'feedback-1']);
  });

  it('applies a custom Auckland calendar date range without changing source records', () => {
    const feedbacks = [
      createFeedback({ uuid: 'feedback-before', timestamp: Date.parse('2026-08-19T11:59:59Z') }),
      createFeedback({ uuid: 'feedback-start', timestamp: Date.parse('2026-08-19T12:00:00Z') }),
      createFeedback({ uuid: 'feedback-end', timestamp: Date.parse('2026-08-20T11:59:59Z') }),
      createFeedback({ uuid: 'feedback-after', timestamp: Date.parse('2026-08-20T12:00:00Z') }),
    ];

    const result = selectFeedbackList(feedbacks, {
      ...defaultOptions,
      timeRange: 'custom',
      dateFrom: '2026-08-20',
      dateTo: '2026-08-20',
    });

    expect(result.map((feedback) => feedback.uuid).sort()).toEqual([
      'feedback-end',
      'feedback-start',
    ]);
    expect(feedbacks[0]?.timestamp).toBe(Date.parse('2026-08-19T11:59:59Z'));
  });
});

describe('feedbackTime helpers', () => {
  it('maps feedback instants and calendar slider values to Auckland dates', () => {
    expect(formatFeedbackCalendarDate(Date.parse('2026-08-19T11:59:59Z'))).toBe('2026-08-19');
    expect(formatFeedbackCalendarDate(Date.parse('2026-08-19T12:00:00Z'))).toBe('2026-08-20');
    expect(formatFeedbackCalendarDate(Date.parse('2026-08-20T11:59:59Z'))).toBe('2026-08-20');
    expect(formatFeedbackCalendarDate(Date.parse('2026-08-20T12:00:00Z'))).toBe('2026-08-21');
    expect(formatFeedbackCalendarDate(toFeedbackCalendarDayTimestamp('2026-08-20'))).toBe(
      '2026-08-20',
    );
  });
});
