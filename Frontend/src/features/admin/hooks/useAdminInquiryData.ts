import { useMemo } from 'react';
import { selectInquiryCounts, selectInquiryList } from '../selectors/inquirySelectors';
import { useCurrentStaffStore } from '../store/currentStaffStore';
import { useInquiryStore } from '../store/inquiryStore';
import type {
  InquiryConversation,
  InquiryNotesFilter,
  InquirySort,
  InquirySupportStatusFilter,
  InquiryTab,
} from '../types/inquiry';
import { useAdminInquirySnapshot } from './useAdminInquirySnapshot';
import { useInquiryListLiveUpdates } from './useInquiryListLiveUpdates';

interface UseAdminInquiryDataOptions {
  tab: InquiryTab;
  searchQuery: string;
  supportStatusFilter: InquirySupportStatusFilter;
  dateFrom: string;
  dateTo: string;
  assigneeId: 'All' | 'Unassigned' | string;
  parentNameQuery: string;
  topicQuery: string;
  durationMin: number | null;
  durationMax: number | null;
  notesFilter: InquiryNotesFilter;
  sort: InquirySort;
}

interface AdminInquiryDataState {
  inquiries: InquiryConversation[];
  counts: { active: number; closed: number };
  loading: boolean;
  error: string | null;
  isManager: boolean;
}

export const useAdminInquiryData = ({
  tab,
  searchQuery,
  supportStatusFilter,
  dateFrom,
  dateTo,
  assigneeId,
  parentNameQuery,
  topicQuery,
  durationMin,
  durationMax,
  notesFilter,
  sort,
}: UseAdminInquiryDataOptions): AdminInquiryDataState => {
  useAdminInquirySnapshot();
  useInquiryListLiveUpdates();

  const inquiryByUuid = useInquiryStore((state) => state.inquiryByUuid);
  const inquiryUuids = useInquiryStore((state) => state.inquiryUuids);
  const snapshotStatus = useInquiryStore((state) => state.snapshotStatus);
  const snapshotError = useInquiryStore((state) => state.snapshotError);
  const staff = useCurrentStaffStore((state) => state.staff);
  const isManager = staff?.employee_role === 'manager';

  const scopedInquiries = useMemo(() => {
    const all = inquiryUuids.flatMap((uuid) => {
      const inquiry = inquiryByUuid[uuid];
      return inquiry ? [inquiry] : [];
    });
    if (isManager || !staff) {
      return all;
    }
    return all.filter((inquiry) => inquiry.assignee?.id === staff.id);
  }, [inquiryByUuid, inquiryUuids, isManager, staff]);

  const inquiries = useMemo(
    () =>
      selectInquiryList(scopedInquiries, {
        tab,
        searchQuery,
        supportStatusFilter,
        dateFrom,
        dateTo,
        assigneeId,
        parentNameQuery,
        topicQuery,
        durationMin,
        durationMax,
        notesFilter,
        sort,
      }),
    [
      scopedInquiries,
      tab,
      searchQuery,
      supportStatusFilter,
      dateFrom,
      dateTo,
      assigneeId,
      parentNameQuery,
      topicQuery,
      durationMin,
      durationMax,
      notesFilter,
      sort,
    ],
  );

  const counts = useMemo(() => selectInquiryCounts(scopedInquiries), [scopedInquiries]);

  return {
    inquiries,
    counts,
    loading: snapshotStatus === 'idle' || snapshotStatus === 'loading',
    error: snapshotError,
    isManager,
  };
};
