import React, { type ReactNode } from 'react';
import { SegmentedControl } from '../../../../shared/components/ui/SegmentedControl';
import { Select } from '../../../../shared/components/ui/Select';
import { FEEDBACK_TYPES, type FeedbackType } from '../../../../shared/types/feedback';
import {
  type FeedbackSortOption,
  type FeedbackStatusFilter,
  type FeedbackTypeFilter,
  type FeedbackViewMode,
  isFeedbackSortOption,
  isFeedbackTypeFilter,
} from '../../types/feedback';
import { FeedbackViewToggle } from './FeedbackViewToggle';

interface FeedbackFilterBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  statusFilter: FeedbackStatusFilter;
  onStatusChange: (value: FeedbackStatusFilter) => void;
  hasUnreadNotification: boolean;
  onUnreadClick: () => void;
  typeFilter: FeedbackTypeFilter;
  onTypeChange: (value: FeedbackTypeFilter) => void;
  sortOption: FeedbackSortOption;
  onSortChange: (value: FeedbackSortOption) => void;
  toolbarActions?: ReactNode;
  additionalFilters?: ReactNode;
  rangeFilter: ReactNode;
  viewMode: FeedbackViewMode;
  onViewModeChange: (value: FeedbackViewMode) => void;
  statusLabels?: {
    all: string;
    unread: string;
    read: string;
  };
}

const FEEDBACK_TYPE_ICONS: Record<FeedbackType, string> = {
  Issue: '🔴',
  Suggestion: '🟡',
  Praise: '🟢',
};

export const FeedbackFilterBar: React.FC<FeedbackFilterBarProps> = ({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  hasUnreadNotification,
  onUnreadClick,
  typeFilter,
  onTypeChange,
  sortOption,
  onSortChange,
  toolbarActions,
  additionalFilters,
  rangeFilter,
  viewMode,
  onViewModeChange,
  statusLabels,
}) => (
  <div className="mb-8 flex flex-col gap-4">
    <div
      className="flex flex-wrap items-center justify-between gap-4"
      data-testid="feedback-toolbar-top-row"
    >
      <div className="relative w-full max-w-xl">
        <svg
          className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-notice-muted"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          placeholder="Search feedback..."
          className="type-body w-full rounded-lg border border-field-border bg-surface-card py-2 pl-10 pr-4 text-notice-secondary transition-all focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/20"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {toolbarActions}
        <FeedbackViewToggle viewMode={viewMode} onChange={onViewModeChange} />
      </div>
    </div>

    <div
      className="flex flex-wrap items-center justify-start gap-3 lg:justify-between"
      data-testid="feedback-filter-row"
    >
      <div className="relative">
        <select
          className="type-button cursor-pointer appearance-none rounded-full border border-field-border bg-surface-card py-2 pl-4 pr-10 text-notice-secondary transition-colors hover:bg-surface-cream focus:outline-none focus:ring-2 focus:ring-focus/20"
          value={typeFilter}
          onChange={(event) => {
            if (isFeedbackTypeFilter(event.target.value)) onTypeChange(event.target.value);
          }}
        >
          <option value="All">Type: All</option>
          {FEEDBACK_TYPES.map((type) => (
            <option key={type} value={type}>
              {FEEDBACK_TYPE_ICONS[type]} {type}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-notice-muted">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {additionalFilters}

      <SegmentedControl<FeedbackStatusFilter>
        options={[
          { value: 'all', label: statusLabels?.all ?? 'All' },
          {
            value: 'unread',
            label: statusLabels?.unread ?? 'Unread',
            hasNotification: hasUnreadNotification,
          },
          { value: 'read', label: statusLabels?.read ?? 'Read' },
        ]}
        value={statusFilter}
        onChange={onStatusChange}
        onOptionClick={(value) => {
          if (value === 'unread') onUnreadClick();
        }}
      />

      <Select
        className="ml-2"
        value={sortOption}
        onChange={(value) => {
          if (isFeedbackSortOption(value)) onSortChange(value);
        }}
        options={[
          { value: 'newest', label: 'Newest First' },
          { value: 'oldest', label: 'Oldest First' },
          { value: 'highest', label: 'Highest Rating' },
          { value: 'lowest', label: 'Lowest Rating' },
        ]}
        icon={
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
            />
          </svg>
        }
      />

      {rangeFilter}
    </div>
  </div>
);
