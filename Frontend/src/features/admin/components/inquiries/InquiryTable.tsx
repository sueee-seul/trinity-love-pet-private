import type { ReactElement } from 'react';
import { LoadingState } from '../../../../shared/components/ui/LoadingState';
import { Select } from '../../../../shared/components/ui/Select';
import type {
  InquiryAssignee,
  InquiryConversation,
  InquirySort,
  InquirySortField,
  TopicCategory,
} from '../../types/inquiry';
import { formatInquiryDayLabel, formatInquiryTime } from '../../utils/inquiryTime';
import { ConversationStatusBadge } from './ConversationStatusBadge';
import { SupportStatusBadge } from './SupportStatusBadge';

interface InquiryTableProps {
  inquiries: InquiryConversation[];
  selectedUuid: string | null;
  onSelect: (uuid: string) => void;
  isManager: boolean;
  assigneeOptions: InquiryAssignee[];
  onAssigneeChange: (uuid: string, assignee: InquiryAssignee | null) => void;
  loading: boolean;
  error: string | null;
  sort: InquirySort;
  onSortChange: (field: InquirySortField) => void;
}

function SortableHeader({
  field,
  label,
  sort,
  onSortChange,
}: {
  field: InquirySortField;
  label: string;
  sort: InquirySort;
  onSortChange: (field: InquirySortField) => void;
}): ReactElement {
  const isActive = sort.field === field;

  return (
    <th className="px-4 py-3 text-left">
      <button
        type="button"
        onClick={() => onSortChange(field)}
        aria-label={`Sort by ${label}, currently ${isActive ? sort.direction + 'ending' : 'not sorted'}`}
        className={`flex items-center gap-1 type-eyebrow transition-colors ${
          isActive
            ? 'text-accent-foreground'
            : 'text-notice-muted hover:text-accent-foreground-hover'
        }`}
      >
        {label}
        <svg
          className={`h-3 w-3 transition-transform ${isActive && sort.direction === 'asc' ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </th>
  );
}

const TOPIC_META: Record<TopicCategory, { path: string; label: string }> = {
  Feeding: {
    path: 'M12 3c-3 3-5 5.5-5 8.5A5 5 0 0012 17a5 5 0 005-5.5C17 8.5 15 6 12 3z',
    label: 'Pet care',
  },
  Booking: {
    path: 'M8 7V3m8 4V3M4 11h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z',
    label: 'Booking',
  },
  Medication: {
    path: 'M9 3h6a1 1 0 011 1v5H8V4a1 1 0 011-1zM8 9h8v9a3 3 0 01-3 3h-2a3 3 0 01-3-3V9z',
    label: 'Health',
  },
  General: {
    path: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
    label: 'General',
  },
};

function formatRequestedAtLabel(iso: string | null): string | undefined {
  if (!iso) return undefined;
  return `Requested ${formatInquiryTime(iso)}`;
}

export function InquiryTable({
  inquiries,
  selectedUuid,
  onSelect,
  isManager,
  assigneeOptions,
  onAssigneeChange,
  loading,
  error,
  sort,
  onSortChange,
}: InquiryTableProps): ReactElement {
  if (loading) {
    return <LoadingState label="Loading inquiries…" variant="section" />;
  }

  if (error) {
    return (
      <div role="alert" className="p-6 text-center type-body text-status-danger">
        {error}
      </div>
    );
  }

  if (inquiries.length === 0) {
    return (
      <div className="p-6 text-center type-body text-notice-muted">No conversations found.</div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[960px] border-collapse">
        <thead>
          <tr className="border-b border-border-soft bg-surface-deep type-eyebrow text-notice-muted">
            <th className="px-4 py-3 text-left">Pet Parent</th>
            <th className="px-4 py-3 text-left">Topic</th>
            <SortableHeader
              field="startedAt"
              label="Started"
              sort={sort}
              onSortChange={onSortChange}
            />
            <SortableHeader
              field="durationMinutes"
              label="Duration"
              sort={sort}
              onSortChange={onSortChange}
            />
            <th className="px-4 py-3 text-left">Support Status</th>
            <th className="px-4 py-3 text-left">Assignee</th>
            <th className="px-4 py-3 text-left">Notes</th>
            <th className="px-4 py-3 text-left">Status</th>
          </tr>
        </thead>
        <tbody>
          {inquiries.map((inquiry) => {
            const topic = TOPIC_META[inquiry.topicCategory];
            const isSelected = inquiry.uuid === selectedUuid;

            return (
              <tr
                key={inquiry.uuid}
                onClick={() => onSelect(inquiry.uuid)}
                className={`min-h-[62px] cursor-pointer border-b border-border-soft transition-colors ${
                  isSelected ? 'bg-apricot-cream-100' : 'hover:bg-apricot-cream-100/60'
                }`}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent-foreground type-meta font-bold text-surface-card">
                      {inquiry.parentInitials}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate type-body font-bold text-notice-primary">
                        {inquiry.parentName}
                      </p>
                      {inquiry.petName && (
                        <p className="flex items-center gap-1 truncate type-meta text-notice-muted">
                          <svg
                            className="h-3 w-3"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1.75}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M12 3c-3 3-5 5.5-5 8.5A5 5 0 0012 17a5 5 0 005-5.5C17 8.5 15 6 12 3z"
                            />
                          </svg>
                          {inquiry.petName}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <svg
                      className="h-4 w-4 flex-shrink-0 text-accent-foreground"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.75}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d={topic.path} />
                    </svg>
                    <div className="min-w-0">
                      <p className="truncate type-body text-notice-primary">{inquiry.topic}</p>
                      <p className="truncate type-meta text-notice-muted">{topic.label}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 type-meta text-notice-secondary">
                  {formatInquiryTime(inquiry.startedAt)}
                  <br />
                  {formatInquiryDayLabel(inquiry.startedAt)}
                </td>
                <td className="px-4 py-3 type-meta text-notice-secondary">
                  {inquiry.durationMinutes}m
                </td>
                <td className="px-4 py-3">
                  <SupportStatusBadge
                    status={inquiry.supportStatus}
                    requestedAt={inquiry.supportRequestedAt}
                    requestedAtLabel={formatRequestedAtLabel(inquiry.supportRequestedAt)}
                  />
                </td>
                <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                  {isManager ? (
                    <Select
                      aria-label={`Assignee for ${inquiry.parentName}`}
                      value={inquiry.assignee?.id ?? 'Unassigned'}
                      onChange={(value) => {
                        const assignee =
                          assigneeOptions.find((option) => option.id === value) ?? null;
                        onAssigneeChange(inquiry.uuid, assignee);
                      }}
                      selectClassName="type-meta py-1.5 pl-3 pr-8"
                      options={[
                        { value: 'Unassigned', label: 'Unassigned' },
                        ...assigneeOptions.map((option) => ({
                          value: option.id,
                          label: option.name,
                        })),
                      ]}
                    />
                  ) : (
                    <span className="flex items-center gap-2 type-meta text-notice-secondary">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-apricot-cream-100 type-meta font-bold text-accent-foreground">
                        {inquiry.assignee?.name.charAt(0) ?? '?'}
                      </span>
                      You
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded ${
                      inquiry.notes
                        ? 'bg-apricot-cream-100 text-accent-foreground'
                        : 'text-notice-muted/50'
                    }`}
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.75}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </span>
                </td>
                <td className="px-4 py-3">
                  <ConversationStatusBadge status={inquiry.status} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
