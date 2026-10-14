import type { ReactElement } from 'react';
import { Select } from '../../../../shared/components/ui/Select';
import { DateField } from '../../../../shared/components/ui/date';
import {
  isInquiryNotesFilter,
  isInquirySupportStatusFilter,
  SUPPORT_STATUSES,
  type InquiryAssignee,
  type InquiryNotesFilter,
  type InquirySupportStatusFilter,
  type InquiryTab,
} from '../../types/inquiry';
import { todayInquiryCalendarDate } from '../../utils/inquiryTime';

interface InquiryRailProps {
  tab: InquiryTab;
  onTabChange: (tab: InquiryTab) => void;
  counts: { active: number; closed: number };
  isManager: boolean;
  supportStatusFilter: InquirySupportStatusFilter;
  onSupportStatusFilterChange: (value: InquirySupportStatusFilter) => void;
  dateFrom: string;
  onDateFromChange: (value: string) => void;
  dateTo: string;
  onDateToChange: (value: string) => void;
  assigneeId: string;
  onAssigneeIdChange: (value: string) => void;
  assigneeOptions: InquiryAssignee[];
  parentNameQuery: string;
  onParentNameQueryChange: (value: string) => void;
  topicQuery: string;
  onTopicQueryChange: (value: string) => void;
  durationMin: number | null;
  onDurationMinChange: (value: number | null) => void;
  durationMax: number | null;
  onDurationMaxChange: (value: number | null) => void;
  notesFilter: InquiryNotesFilter;
  onNotesFilterChange: (value: InquiryNotesFilter) => void;
}

export function InquiryRail({
  tab,
  onTabChange,
  counts,
  isManager,
  supportStatusFilter,
  onSupportStatusFilterChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  assigneeId,
  onAssigneeIdChange,
  assigneeOptions,
  parentNameQuery,
  onParentNameQueryChange,
  topicQuery,
  onTopicQueryChange,
  durationMin,
  onDurationMinChange,
  durationMax,
  onDurationMaxChange,
  notesFilter,
  onNotesFilterChange,
}: InquiryRailProps): ReactElement {
  const today = todayInquiryCalendarDate();

  const parseDurationInput = (value: string): number | null => {
    if (value.trim() === '') return null;
    const parsed = Number(value);
    return Number.isNaN(parsed) || parsed < 0 ? null : parsed;
  };

  return (
    <div className="flex h-full w-[208px] flex-shrink-0 flex-col border-r border-border-soft bg-surface-card">
      <div className="flex items-center gap-2 border-b border-border-soft p-4">
        <svg
          className="h-5 w-5 text-accent-foreground"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.75}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
        <h2 className="type-card-title">Inquiries</h2>
      </div>

      {!isManager && (
        <div className="mx-4 mt-4 rounded-lg bg-apricot-cream-100 p-3 type-meta text-accent-foreground">
          You&apos;re seeing conversations assigned to you.
        </div>
      )}

      <div className="space-y-1 p-4">
        <button
          type="button"
          onClick={() => onTabChange('Active')}
          className={`flex w-full items-center justify-between rounded-lg px-3 py-2 type-button transition-colors ${
            tab === 'Active'
              ? 'bg-apricot-cream-100 text-accent-foreground'
              : 'text-notice-secondary hover:bg-surface-cream'
          }`}
        >
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-status-success" />
            Active
          </span>
          <span className="type-meta text-notice-muted">{counts.active}</span>
        </button>
        <button
          type="button"
          onClick={() => onTabChange('Closed')}
          className={`flex w-full items-center justify-between rounded-lg px-3 py-2 type-button transition-colors ${
            tab === 'Closed'
              ? 'bg-apricot-cream-100 text-accent-foreground'
              : 'text-notice-secondary hover:bg-surface-cream'
          }`}
        >
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-notice-muted" />
            Closed
          </span>
          <span className="type-meta text-notice-muted">{counts.closed}</span>
        </button>
      </div>

      <div className="border-t border-border-soft p-4">
        <h2 className="mb-3 type-eyebrow text-notice-muted">Filters</h2>
        <div className="space-y-2">
          <div>
            <label className="mb-1 block type-meta text-notice-muted" htmlFor="inquiry-parent-name">
              Pet Parent
            </label>
            <input
              id="inquiry-parent-name"
              type="text"
              value={parentNameQuery}
              onChange={(event) => onParentNameQueryChange(event.target.value)}
              placeholder="Filter by name…"
              className="w-full rounded-lg border border-field-border bg-surface-card px-3 py-1.5 type-meta text-notice-secondary placeholder:text-notice-muted focus:outline-none focus:ring-2 focus:ring-focus/20"
            />
          </div>
          <div>
            <label className="mb-1 block type-meta text-notice-muted" htmlFor="inquiry-topic">
              Topic
            </label>
            <input
              id="inquiry-topic"
              type="text"
              value={topicQuery}
              onChange={(event) => onTopicQueryChange(event.target.value)}
              placeholder="Filter by topic…"
              className="w-full rounded-lg border border-field-border bg-surface-card px-3 py-1.5 type-meta text-notice-secondary placeholder:text-notice-muted focus:outline-none focus:ring-2 focus:ring-focus/20"
            />
          </div>
          {isManager && (
            <Select
              aria-label="Filter by assignee"
              value={assigneeId}
              onChange={onAssigneeIdChange}
              selectClassName="type-meta py-1.5 pl-3"
              options={[
                { value: 'All', label: 'All Assignees' },
                { value: 'Unassigned', label: 'Unassigned' },
                ...assigneeOptions.map((assignee) => ({
                  value: assignee.id,
                  label: assignee.name,
                })),
              ]}
            />
          )}
          <Select
            aria-label="Filter by support status"
            value={supportStatusFilter}
            onChange={(value) => {
              if (isInquirySupportStatusFilter(value)) {
                onSupportStatusFilterChange(value);
              }
            }}
            selectClassName="type-meta py-1.5 pl-3"
            options={[
              { value: 'All', label: 'Support Status' },
              ...SUPPORT_STATUSES.map((status) => ({ value: status, label: status })),
            ]}
          />
          <div>
            <span className="mb-1 block type-meta text-notice-muted">Date Range</span>
            <div className="grid grid-cols-2 gap-2">
              <label className="sr-only" htmlFor="inquiry-date-from">
                Date range from
              </label>
              <DateField
                id="inquiry-date-from"
                locale="en"
                value={dateFrom}
                max={dateTo && dateTo < today ? dateTo : today}
                // The calendar already disables days after max. The clamp is kept as a second
                // guard, so no later change to the calendar can let a future day through.
                onChange={(value) => onDateFromChange(value > today ? today : value)}
                className="min-w-0 rounded-lg border border-field-border bg-surface-card px-2 py-1.5 type-meta text-notice-secondary focus:outline-none focus:ring-2 focus:ring-focus/20"
              />
              <label className="sr-only" htmlFor="inquiry-date-to">
                Date range to
              </label>
              <DateField
                id="inquiry-date-to"
                locale="en"
                value={dateTo}
                min={dateFrom || undefined}
                max={today}
                onChange={(value) => onDateToChange(value > today ? today : value)}
                className="min-w-0 rounded-lg border border-field-border bg-surface-card px-2 py-1.5 type-meta text-notice-secondary focus:outline-none focus:ring-2 focus:ring-focus/20"
              />
            </div>
            {(dateFrom || dateTo) && (
              <button
                type="button"
                onClick={() => {
                  onDateFromChange('');
                  onDateToChange('');
                }}
                className="mt-1 type-meta font-bold text-accent-foreground hover:text-accent-foreground-hover"
              >
                Clear dates
              </button>
            )}
          </div>

          <div>
            <span className="mb-1 block type-meta text-notice-muted">Duration (minutes)</span>
            <div className="grid grid-cols-2 gap-2">
              <label className="sr-only" htmlFor="inquiry-duration-min">
                Minimum duration in minutes
              </label>
              <input
                id="inquiry-duration-min"
                type="number"
                inputMode="numeric"
                min={0}
                max={durationMax ?? undefined}
                value={durationMin ?? ''}
                onChange={(event) => {
                  const parsed = parseDurationInput(event.target.value);
                  onDurationMinChange(
                    parsed !== null && durationMax !== null
                      ? Math.min(parsed, durationMax)
                      : parsed,
                  );
                }}
                placeholder="Min"
                className="min-w-0 rounded-lg border border-field-border bg-surface-card px-2 py-1.5 type-meta text-notice-secondary placeholder:text-notice-muted focus:outline-none focus:ring-2 focus:ring-focus/20"
              />
              <label className="sr-only" htmlFor="inquiry-duration-max">
                Maximum duration in minutes
              </label>
              <input
                id="inquiry-duration-max"
                type="number"
                inputMode="numeric"
                min={durationMin ?? 0}
                value={durationMax ?? ''}
                onChange={(event) => {
                  const parsed = parseDurationInput(event.target.value);
                  onDurationMaxChange(
                    parsed !== null && durationMin !== null
                      ? Math.max(parsed, durationMin)
                      : parsed,
                  );
                }}
                placeholder="Max"
                className="min-w-0 rounded-lg border border-field-border bg-surface-card px-2 py-1.5 type-meta text-notice-secondary placeholder:text-notice-muted focus:outline-none focus:ring-2 focus:ring-focus/20"
              />
            </div>
            {(durationMin !== null || durationMax !== null) && (
              <button
                type="button"
                onClick={() => {
                  onDurationMinChange(null);
                  onDurationMaxChange(null);
                }}
                className="mt-1 type-meta font-bold text-accent-foreground hover:text-accent-foreground-hover"
              >
                Clear duration
              </button>
            )}
          </div>

          <Select
            aria-label="Filter by notes"
            value={notesFilter}
            onChange={(value) => {
              if (isInquiryNotesFilter(value)) {
                onNotesFilterChange(value);
              }
            }}
            selectClassName="type-meta py-1.5 pl-3"
            options={[
              { value: 'All', label: 'Notes: All' },
              { value: 'With notes', label: 'With notes' },
              { value: 'No notes', label: 'No notes' },
            ]}
          />
        </div>
      </div>

      <div className="mt-auto border-t border-border-soft p-4 type-meta text-notice-muted">
        Need help? Contact the support team.
      </div>
    </div>
  );
}
