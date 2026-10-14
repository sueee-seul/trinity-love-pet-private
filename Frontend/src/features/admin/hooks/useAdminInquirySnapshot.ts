import { useEffect } from 'react';
import { fetchInquiries } from '../api/inquiryApi';
import { useCurrentStaffStore } from '../store/currentStaffStore';
import { useInquiryStore } from '../store/inquiryStore';
import { useStaffDirectory } from './useStaffDirectory';

/** Hydrates the inquiry store from `GET /api/admin/inquiries` once the signed-in employee and the staff directory (used to resolve assignee/author names) are both known. */
export const useAdminInquirySnapshot = (): void => {
  const staff = useCurrentStaffStore((state) => state.staff);
  const { staff: staffDirectory, loading: staffDirectoryLoading } = useStaffDirectory();
  const snapshotStatus = useInquiryStore((state) => state.snapshotStatus);
  const setSnapshotLoading = useInquiryStore((state) => state.setSnapshotLoading);
  const hydrateInquirySnapshot = useInquiryStore((state) => state.hydrateInquirySnapshot);
  const setSnapshotError = useInquiryStore((state) => state.setSnapshotError);

  useEffect(() => {
    // Only ever attempted once per store lifetime - an error here doesn't
    // retry on its own (matching the pet-parent side's `hasLoadedConversations`
    // gate), both to avoid a retry storm and because a re-render triggered
    // elsewhere (e.g. the staff directory settling) must not re-fire this.
    if (snapshotStatus !== 'idle' || !staff || staffDirectoryLoading) {
      return;
    }

    setSnapshotLoading();
    const staffDirectoryByUuid = new Map(
      staffDirectory.map((member) => [
        member.id,
        { name: member.name, role: member.employee_role },
      ]),
    );
    fetchInquiries(staffDirectoryByUuid)
      .then((inquiries) => hydrateInquirySnapshot(inquiries, staffDirectoryByUuid))
      .catch((error: unknown) => {
        console.error('Failed to load inquiries', error);
        setSnapshotError(error instanceof Error ? error.message : 'Could not load inquiries');
      });
  }, [
    hydrateInquirySnapshot,
    setSnapshotError,
    setSnapshotLoading,
    snapshotStatus,
    staff,
    staffDirectory,
    staffDirectoryLoading,
  ]);
};
