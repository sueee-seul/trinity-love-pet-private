import { useEffect } from 'react';
import {
  buildAdminInquiryEventsUrl,
  subscribeToConversationServerEvents,
} from '../../../shared/events/conversationServerEvents';
import { useInquiryStore } from '../store/inquiryStore';

/**
 * Keeps the currently-open inquiry live: subscribes to its SSE stream so a
 * pet owner's new message (or another staff member's reply) shows up in the
 * detail panel without a reload.
 */
export const useInquiryLiveUpdates = (): void => {
  const openConversationUuid = useInquiryStore((state) => state.openConversationUuid);
  const refreshInquiry = useInquiryStore((state) => state.refreshInquiry);

  useEffect(() => {
    if (!openConversationUuid) {
      return;
    }
    return subscribeToConversationServerEvents(
      buildAdminInquiryEventsUrl(openConversationUuid),
      openConversationUuid,
      () => {
        void refreshInquiry(openConversationUuid);
      },
    );
  }, [openConversationUuid, refreshInquiry]);
};
