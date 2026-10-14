import { beforeEach, describe, expect, it } from 'vitest';
import { useFeedbackStore } from '../feedbackStore';
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

describe('feedbackStore', () => {
  beforeEach(() => {
    useFeedbackStore.getState().resetFeedbackSnapshot();
  });

  it('hydrates normalized feedback data by UUID', () => {
    useFeedbackStore.getState().hydrateFeedbackSnapshot([feedback]);

    expect(useFeedbackStore.getState().feedbackUuids).toEqual(['feedback-1']);
    expect(useFeedbackStore.getState().feedbackByUuid['feedback-1']).toEqual(feedback);
    expect(useFeedbackStore.getState().snapshotStatus).toBe('ready');
  });

  it('replaces one feedback record without clearing unrelated records', () => {
    const secondFeedback = { ...feedback, uuid: 'feedback-2', parentName: 'Ben Smith' };
    const updatedFeedback = { ...feedback, current_status: 'review_started' as const };
    useFeedbackStore.getState().hydrateFeedbackSnapshot([feedback, secondFeedback]);

    useFeedbackStore.getState().replaceFeedback(updatedFeedback);

    expect(useFeedbackStore.getState().feedbackByUuid['feedback-1']?.current_status).toBe(
      'review_started',
    );
    expect(useFeedbackStore.getState().feedbackByUuid['feedback-2']).toEqual(secondFeedback);
  });

  it('patches read state without changing the snapshot order', () => {
    const secondFeedback = { ...feedback, uuid: 'feedback-2', parentName: 'Ben Smith' };
    useFeedbackStore.getState().hydrateFeedbackSnapshot([feedback, secondFeedback]);

    useFeedbackStore.getState().markFeedbacksRead(['feedback-1']);

    expect(useFeedbackStore.getState().feedbackUuids).toEqual(['feedback-1', 'feedback-2']);
    expect(useFeedbackStore.getState().feedbackByUuid['feedback-1']?.is_read).toBe(true);
    expect(useFeedbackStore.getState().feedbackByUuid['feedback-2']?.is_read).toBe(false);
  });

  it('removes one feedback without affecting unrelated records', () => {
    const secondFeedback = { ...feedback, uuid: 'feedback-2', parentName: 'Ben Smith' };
    useFeedbackStore.getState().hydrateFeedbackSnapshot([feedback, secondFeedback]);

    useFeedbackStore.getState().removeFeedback('feedback-1');

    expect(useFeedbackStore.getState().feedbackUuids).toEqual(['feedback-2']);
    expect(useFeedbackStore.getState().feedbackByUuid['feedback-1']).toBeUndefined();
    expect(useFeedbackStore.getState().feedbackByUuid['feedback-2']).toEqual(secondFeedback);
  });
});
