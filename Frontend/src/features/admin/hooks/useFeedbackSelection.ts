import { useCallback, useState } from 'react';

interface FeedbackSelectionState {
  selectedUuids: Set<string>;
  toggleSelection: (feedbackUuid: string) => void;
  toggleVisibleSelection: (feedbackUuids: string[]) => void;
  clearSelection: () => void;
}

export const useFeedbackSelection = (): FeedbackSelectionState => {
  const [selectedUuids, setSelectedUuids] = useState<Set<string>>(() => new Set());

  const toggleSelection = useCallback((feedbackUuid: string) => {
    setSelectedUuids((currentUuids) => {
      const nextUuids = new Set(currentUuids);
      if (nextUuids.has(feedbackUuid)) {
        nextUuids.delete(feedbackUuid);
      } else {
        nextUuids.add(feedbackUuid);
      }
      return nextUuids;
    });
  }, []);

  const toggleVisibleSelection = useCallback((feedbackUuids: string[]) => {
    setSelectedUuids((currentUuids) => {
      const allVisibleSelected =
        feedbackUuids.length > 0 &&
        feedbackUuids.every((feedbackUuid) => currentUuids.has(feedbackUuid));
      const nextUuids = new Set(currentUuids);

      feedbackUuids.forEach((feedbackUuid) => {
        if (allVisibleSelected) {
          nextUuids.delete(feedbackUuid);
        } else {
          nextUuids.add(feedbackUuid);
        }
      });

      return nextUuids;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedUuids((currentUuids) => (currentUuids.size === 0 ? currentUuids : new Set()));
  }, []);

  return {
    selectedUuids,
    toggleSelection,
    toggleVisibleSelection,
    clearSelection,
  };
};
