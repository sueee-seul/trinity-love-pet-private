import { useEffect } from 'react';
import { subscribeToInquiryCreatedEvents } from '../../../shared/events/conversationServerEvents';
import { fetchInquiry } from '../api/inquiryApi';
import { useInquiryStore } from '../store/inquiryStore';

/**
 * Keeps the Inquiries list live: as soon as a pet parent starts a new
 * conversation, fetches it and splices it into the store so it shows up on
 * the Inquiries Page without a reload, leaving every other inquiry untouched.
 */
export const useInquiryListLiveUpdates = (): void => {
  const snapshotStatus = useInquiryStore((state) => state.snapshotStatus);
  const staffDirectoryByUuid = useInquiryStore((state) => state.staffDirectoryByUuid);
  const addInquiry = useInquiryStore((state) => state.addInquiry);

  useEffect(() => {
    // Only listen once the initial snapshot (and the staff directory it
    // resolves names against) has actually loaded.
    if (snapshotStatus !== 'ready') {
      return;
    }
    return subscribeToInquiryCreatedEvents((conversationId) => {
      fetchInquiry(conversationId, staffDirectoryByUuid)
        .then(addInquiry)
        .catch((error: unknown) => console.error('Failed to load the new inquiry', error));
    });
  }, [snapshotStatus, staffDirectoryByUuid, addInquiry]);
};
