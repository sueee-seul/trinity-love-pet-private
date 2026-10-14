import { useMemo, useState, type ReactElement } from 'react';
import { InquiryListHeader } from '../components/inquiries/InquiryListHeader';
import { InquiryRail } from '../components/inquiries/InquiryRail';
import { InquiryTable } from '../components/inquiries/InquiryTable';
import { useAdminInquiryData } from '../hooks/useAdminInquiryData';
import { useStaffDirectory } from '../hooks/useStaffDirectory';
import { useInquiryStore } from '../store/inquiryStore';
import type {
  InquiryAssignee,
  InquiryNotesFilter,
  InquirySort,
  InquirySortField,
  InquirySupportStatusFilter,
  InquiryTab,
} from '../types/inquiry';

export function AdminInquiriesPage(): ReactElement {
  const [tab, setTab] = useState<InquiryTab>('Active');
  const [searchQuery, setSearchQuery] = useState('');
  const [supportStatusFilter, setSupportStatusFilter] = useState<InquirySupportStatusFilter>('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [assigneeId, setAssigneeId] = useState<string>('All');
  const [parentNameQuery, setParentNameQuery] = useState('');
  const [topicQuery, setTopicQuery] = useState('');
  const [durationMin, setDurationMin] = useState<number | null>(null);
  const [durationMax, setDurationMax] = useState<number | null>(null);
  const [notesFilter, setNotesFilter] = useState<InquiryNotesFilter>('All');
  const [sort, setSort] = useState<InquirySort>({ field: 'startedAt', direction: 'desc' });

  const { inquiries, counts, loading, error, isManager } = useAdminInquiryData({
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
  });

  const handleSortChange = (field: InquirySortField): void => {
    setSort((current) =>
      current.field === field
        ? { field, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : // Started defaults to newest-first, Duration to shortest-first, on first click.
          { field, direction: field === 'startedAt' ? 'desc' : 'asc' },
    );
  };

  const { staff: staffDirectory } = useStaffDirectory();
  const setAssignee = useInquiryStore((state) => state.setAssignee);
  const openConversationUuid = useInquiryStore((state) => state.openConversationUuid);
  const openConversation = useInquiryStore((state) => state.openConversation);

  const assigneeOptions = useMemo<InquiryAssignee[]>(
    () => staffDirectory.map((member) => ({ id: member.id, name: member.name })),
    [staffDirectory],
  );

  const handleTabChange = (nextTab: InquiryTab): void => {
    setTab(nextTab);
  };

  return (
    <div className="-m-4 flex h-[calc(100vh-64px)] overflow-hidden sm:-m-6 lg:-m-8">
      <InquiryRail
        tab={tab}
        onTabChange={handleTabChange}
        counts={counts}
        isManager={isManager}
        supportStatusFilter={supportStatusFilter}
        onSupportStatusFilterChange={setSupportStatusFilter}
        dateFrom={dateFrom}
        onDateFromChange={setDateFrom}
        dateTo={dateTo}
        onDateToChange={setDateTo}
        assigneeId={assigneeId}
        onAssigneeIdChange={setAssigneeId}
        assigneeOptions={assigneeOptions}
        parentNameQuery={parentNameQuery}
        onParentNameQueryChange={setParentNameQuery}
        topicQuery={topicQuery}
        onTopicQueryChange={setTopicQuery}
        durationMin={durationMin}
        onDurationMinChange={setDurationMin}
        durationMax={durationMax}
        onDurationMaxChange={setDurationMax}
        notesFilter={notesFilter}
        onNotesFilterChange={setNotesFilter}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <InquiryListHeader searchQuery={searchQuery} onSearchQueryChange={setSearchQuery} />

        <div className="mx-4 mb-4 flex-1 overflow-y-auto rounded-2xl border border-border-soft bg-surface-card">
          <InquiryTable
            inquiries={inquiries}
            selectedUuid={openConversationUuid}
            onSelect={openConversation}
            isManager={isManager}
            assigneeOptions={assigneeOptions}
            onAssigneeChange={(uuid, assignee) => setAssignee(uuid, assignee)}
            loading={loading}
            error={error}
            sort={sort}
            onSortChange={handleSortChange}
          />
        </div>
      </div>
    </div>
  );
}
