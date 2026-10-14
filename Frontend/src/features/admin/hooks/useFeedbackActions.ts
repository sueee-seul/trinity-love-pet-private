import { useState } from 'react';
import { deleteFeedback as deleteFeedbackFromApi, markFeedbacksAsRead } from '../api/feedbackApi';
import { useFeedbackStore } from '../store/feedbackStore';
import type { FeedbackListItem } from '../types/feedback';

export interface FeedbackActionMessage {
  type: 'success' | 'error';
  text: string;
}

interface UseFeedbackActionsOptions {
  selectedUuids: Set<string>;
  feedbacks: FeedbackListItem[];
  clearSelection: () => void;
}

interface FeedbackActionsState {
  isMarkingAsRead: boolean;
  deletingFeedbackUuid: string | null;
  feedbackActionMessage: FeedbackActionMessage | null;
  markReviewed: () => Promise<void>;
  deleteFeedback: (feedbackUuid: string) => Promise<void>;
}

export const useFeedbackActions = ({
  selectedUuids,
  feedbacks,
  clearSelection,
}: UseFeedbackActionsOptions): FeedbackActionsState => {
  const removeFeedbackFromStore = useFeedbackStore((state) => state.removeFeedback);
  const markFeedbacksReadInStore = useFeedbackStore((state) => state.markFeedbacksRead);
  const [isMarkingAsRead, setIsMarkingAsRead] = useState(false);
  const [deletingFeedbackUuid, setDeletingFeedbackUuid] = useState<string | null>(null);
  const [feedbackActionMessage, setFeedbackActionMessage] = useState<FeedbackActionMessage | null>(
    null,
  );

  const markReviewed = async (): Promise<void> => {
    const feedbackUuids = feedbacks
      .filter((feedback) => selectedUuids.has(feedback.uuid) && !feedback.is_read)
      .map((feedback) => feedback.uuid);
    if (feedbackUuids.length === 0 || isMarkingAsRead || deletingFeedbackUuid) {
      return;
    }

    setIsMarkingAsRead(true);
    setFeedbackActionMessage(null);

    try {
      const payload = await markFeedbacksAsRead(feedbackUuids);
      const updatedUuids = new Set(payload.updatedUuids);
      markFeedbacksReadInStore([...updatedUuids]);
      clearSelection();
      setFeedbackActionMessage({
        type: 'success',
        text: `${payload.updatedUuids.length} feedback${payload.updatedUuids.length === 1 ? '' : 's'} reviewed. No action required.`,
      });
    } catch (error) {
      console.error('Failed to mark feedbacks as reviewed', error);
      setFeedbackActionMessage({
        type: 'error',
        text: 'Failed to mark feedback as reviewed. Please try again.',
      });
    } finally {
      setIsMarkingAsRead(false);
    }
  };

  const deleteFeedback = async (feedbackUuid: string): Promise<void> => {
    if (deletingFeedbackUuid || isMarkingAsRead) {
      return;
    }

    setDeletingFeedbackUuid(feedbackUuid);
    setFeedbackActionMessage(null);

    try {
      await deleteFeedbackFromApi(feedbackUuid);
      removeFeedbackFromStore(feedbackUuid);
      clearSelection();
      setFeedbackActionMessage({
        type: 'success',
        text: 'Feedback deleted.',
      });
    } catch (error) {
      console.error('Failed to delete feedback', error);
      setFeedbackActionMessage({
        type: 'error',
        text: 'Could not delete this feedback. Nothing was removed. Please try again.',
      });
    } finally {
      setDeletingFeedbackUuid(null);
    }
  };

  return {
    isMarkingAsRead,
    deletingFeedbackUuid,
    feedbackActionMessage,
    markReviewed,
    deleteFeedback,
  };
};
