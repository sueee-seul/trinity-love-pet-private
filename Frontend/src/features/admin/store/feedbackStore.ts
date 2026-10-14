import { create } from 'zustand';
import type { AdminFeedback } from '../types/feedback';

export type FeedbackSnapshotStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface FeedbackStoreState {
  feedbackByUuid: Record<string, AdminFeedback>;
  feedbackUuids: string[];
  snapshotStatus: FeedbackSnapshotStatus;
  snapshotError: string | null;
  setSnapshotLoading: () => void;
  hydrateFeedbackSnapshot: (feedbacks: AdminFeedback[]) => void;
  setSnapshotError: (message: string) => void;
  replaceFeedback: (feedback: AdminFeedback) => void;
  removeFeedback: (feedbackUuid: string) => void;
  markFeedbacksRead: (feedbackUuids: string[]) => void;
  resetFeedbackSnapshot: () => void;
}

export const useFeedbackStore = create<FeedbackStoreState>((set) => ({
  feedbackByUuid: {},
  feedbackUuids: [],
  snapshotStatus: 'idle',
  snapshotError: null,
  setSnapshotLoading: (): void => {
    set({ snapshotStatus: 'loading', snapshotError: null });
  },
  hydrateFeedbackSnapshot: (feedbacks): void => {
    set({
      feedbackByUuid: Object.fromEntries(feedbacks.map((feedback) => [feedback.uuid, feedback])),
      feedbackUuids: feedbacks.map((feedback) => feedback.uuid),
      snapshotStatus: 'ready',
      snapshotError: null,
    });
  },
  setSnapshotError: (message): void => {
    set({ snapshotStatus: 'error', snapshotError: message });
  },
  replaceFeedback: (feedback): void => {
    set((state) => ({
      feedbackByUuid: {
        ...state.feedbackByUuid,
        [feedback.uuid]: feedback,
      },
      feedbackUuids: state.feedbackUuids.includes(feedback.uuid)
        ? state.feedbackUuids
        : [feedback.uuid, ...state.feedbackUuids],
    }));
  },
  removeFeedback: (feedbackUuid): void => {
    set((state) => ({
      feedbackByUuid: Object.fromEntries(
        Object.entries(state.feedbackByUuid).filter(([uuid]) => uuid !== feedbackUuid),
      ),
      feedbackUuids: state.feedbackUuids.filter((uuid) => uuid !== feedbackUuid),
    }));
  },
  markFeedbacksRead: (feedbackUuids): void => {
    const updatedUuids = new Set(feedbackUuids);
    set((state) => ({
      feedbackByUuid: Object.fromEntries(
        Object.entries(state.feedbackByUuid).map(([uuid, feedback]) => [
          uuid,
          updatedUuids.has(uuid) ? { ...feedback, is_read: true } : feedback,
        ]),
      ),
    }));
  },
  resetFeedbackSnapshot: (): void => {
    set({
      feedbackByUuid: {},
      feedbackUuids: [],
      snapshotStatus: 'idle',
      snapshotError: null,
    });
  },
}));
