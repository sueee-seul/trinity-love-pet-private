import { useEffect } from 'react';
import { fetchFeedbackSnapshot } from '../api/feedbackApi';
import { useFeedbackStore } from '../store/feedbackStore';

let activeSnapshotRequest: Promise<void> | null = null;

export const loadAdminFeedbackSnapshot = async (force = false): Promise<void> => {
  const state = useFeedbackStore.getState();
  if (!force && state.snapshotStatus === 'ready') {
    return;
  }

  if (activeSnapshotRequest) {
    return activeSnapshotRequest;
  }

  state.setSnapshotLoading();
  activeSnapshotRequest = fetchFeedbackSnapshot()
    .then((feedbacks) => {
      useFeedbackStore.getState().hydrateFeedbackSnapshot(feedbacks);
    })
    .catch((error: unknown) => {
      console.error('Failed to load feedback snapshot', error);
      useFeedbackStore.getState().setSnapshotError('Unable to load feedback. Please try again.');
    })
    .finally(() => {
      activeSnapshotRequest = null;
    });

  return activeSnapshotRequest;
};

export const useAdminFeedbackSnapshot = (force = false): void => {
  useEffect(() => {
    void loadAdminFeedbackSnapshot(force);
  }, [force]);
};
