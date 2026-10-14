import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadAdminFeedbackSnapshot } from '../useAdminFeedbackSnapshot';
import { useFeedbackStore } from '../../store/feedbackStore';
import type { AdminFeedback } from '../../types/feedback';

const feedback: AdminFeedback = {
  uuid: 'feedback-1',
  initials: 'AM',
  parentName: 'Ava Mitchell',
  petName: 'Biscuit',
  date: 'Aug 24, 2026',
  timestamp: 1787529600000,
  serviceType: '',
  rating: 3.4,
  aiSummary: 'The parent suggested showing individual pet images.',
  category: 'Suggestion',
  is_read: false,
  assigneeId: null,
  current_status: 'submitted',
  answers: ['The parent suggested showing individual pet images.'],
  timeline: [{ step: 'submitted', timestamp: 'Aug 24, 2026', actor: 'System' }],
};

describe('useAdminFeedbackSnapshot', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    useFeedbackStore.getState().resetFeedbackSnapshot();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fetchMock.mockReset();
    useFeedbackStore.getState().resetFeedbackSnapshot();
  });

  it('force refreshes a ready snapshot when the feedback section is entered again', async () => {
    useFeedbackStore.getState().hydrateFeedbackSnapshot([feedback]);
    const refreshedFeedback = { ...feedback, parentName: 'Refreshed Parent' };
    fetchMock.mockResolvedValue({ ok: true, json: async () => [refreshedFeedback] });

    await loadAdminFeedbackSnapshot(true);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(useFeedbackStore.getState().feedbackByUuid['feedback-1']?.parentName).toBe(
      'Refreshed Parent',
    );
  });
});
