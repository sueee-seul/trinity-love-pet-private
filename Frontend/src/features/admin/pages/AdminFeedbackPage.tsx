import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FeedbackBulkActionBar } from '../components/feedback/FeedbackBulkActionBar';
import { FeedbackCard } from '../components/feedback/FeedbackCard';
import { FeedbackFilterBar } from '../components/feedback/FeedbackFilterBar';
import { FeedbackRangeFilter } from '../components/feedback/FeedbackRangeFilter';
import { FeedbackLoadingSkeleton } from '../components/feedback/FeedbackLoadingSkeleton';
import { FeedbackSourceTabs } from '../components/feedback/FeedbackSourceTabs';
import { FeedbackTable } from '../components/feedback/FeedbackTable';
import { GoogleReviewsPanel } from '../components/feedback/GoogleReviewsPanel';
import {
  GoogleReviewDashboardAction,
  GoogleReviewFilterControls,
} from '../components/feedback/GoogleReviewFilterControls';
import { useAuthStore } from '../../../shared/auth/store/authStore';
import { LoadingState } from '../../../shared/components/ui/LoadingState';
import { useAdminFeedbackData } from '../hooks/useAdminFeedbackData';
import { useFeedbackActions } from '../hooks/useFeedbackActions';
import { useFeedbackSelection } from '../hooks/useFeedbackSelection';
import { AdminPage } from '../components/layout/AdminPage';
import {
  ADMIN_FEEDBACK_PAGE_SIZE,
  type FeedbackSortOption,
  type FeedbackSource,
  type FeedbackStatusFilter,
  type FeedbackTimeFilter,
  type FeedbackTypeFilter,
  type FeedbackViewMode,
  type GoogleReviewAgeFilter,
  isGoogleReviewAgeFilter,
} from '../types/feedback';

const getInitialFeedbackSource = (source: string | null): FeedbackSource => {
  return source === 'internal' ? 'internal' : 'google-reviews';
};

const getInitialFeedbackViewMode = (viewMode: string | null): FeedbackViewMode => {
  return viewMode === 'card' ? 'card' : 'table';
};

const getInitialStatusFilter = (
  source: FeedbackSource,
  status: string | null,
): FeedbackStatusFilter => {
  return source === 'google-reviews' && status === 'unreplied' ? 'unread' : 'all';
};

const getInitialTypeFilter = (source: FeedbackSource, type: string | null): FeedbackTypeFilter => {
  if (source !== 'google-reviews') {
    return 'All';
  }

  switch (type?.toLowerCase()) {
    case 'issue':
      return 'Issue';
    case 'suggestion':
      return 'Suggestion';
    case 'praise':
      return 'Praise';
    default:
      return 'All';
  }
};

const getInitialAgeFilter = (source: FeedbackSource, age: string | null): GoogleReviewAgeFilter => {
  return source === 'google-reviews' && age && isGoogleReviewAgeFilter(age) ? age : 'all';
};

/**
 * Renders the employee feedback workspace, including its separate Google Reviews source.
 *
 * @remarks
 * Within `AdminPortal`, staff are redirected before this manager-routed page renders. The shared
 * tabs and toolbar own source/filter/view state, while the Google branch renders its records from
 * `googleReviewStore` through `GoogleReviewsPanel`; it does not reuse the Internal Feedback row
 * projection. Search parameters seed the initial source, status, type, age, and view values, but
 * subsequent local changes are not written back to the URL. The Google dashboard action navigates
 * to the manager-only `/admin/operation` route.
 */
export const AdminFeedbackPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const employeeRole = useAuthStore((state) => state.user?.employee_role);
  // This flag controls the Google type editor's UI. AdminPortal routes staff away from this page;
  // the API/server remains the authority if a caller reaches the mutation boundary another way.
  const canEditGoogleReviewType = employeeRole === 'manager';
  const initialSource = getInitialFeedbackSource(searchParams.get('source'));
  const [activeSource, setActiveSource] = useState<FeedbackSource>(initialSource);
  const [visibleCount, setVisibleCount] = useState(ADMIN_FEEDBACK_PAGE_SIZE);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FeedbackStatusFilter>(() =>
    getInitialStatusFilter(initialSource, searchParams.get('status')),
  );
  const [typeFilter, setTypeFilter] = useState<FeedbackTypeFilter>(() =>
    getInitialTypeFilter(initialSource, searchParams.get('type')),
  );
  const [ageFilter, setAgeFilter] = useState<GoogleReviewAgeFilter>(() =>
    getInitialAgeFilter(initialSource, searchParams.get('age')),
  );
  const [sortOption, setSortOption] = useState<FeedbackSortOption>('newest');
  const [timeRange, setTimeRange] = useState<FeedbackTimeFilter>('all');
  const [ratingMin, setRatingMin] = useState(1);
  const [ratingMax, setRatingMax] = useState(5);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [viewMode, setViewMode] = useState<FeedbackViewMode>(() =>
    getInitialFeedbackViewMode(searchParams.get('view')),
  );
  const [hasSeenUnread, setHasSeenUnread] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);

  const effectiveTimeRange =
    timeRange === 'custom' ? (dateFrom && dateTo ? 'custom' : 'all') : timeRange;
  const { feedbacks, loading, feedbackError, timeDomain } = useAdminFeedbackData({
    searchQuery,
    statusFilter,
    typeFilter,
    sortOption,
    timeRange: effectiveTimeRange,
    ratingMin,
    ratingMax,
    dateFrom,
    dateTo,
  });
  const { selectedUuids, toggleSelection, toggleVisibleSelection, clearSelection } =
    useFeedbackSelection();
  const {
    isMarkingAsRead,
    deletingFeedbackUuid,
    feedbackActionMessage,
    markReviewed,
    deleteFeedback,
  } = useFeedbackActions({
    selectedUuids,
    feedbacks,
    clearSelection,
  });

  useEffect(() => {
    clearSelection();
  }, [
    clearSelection,
    searchQuery,
    statusFilter,
    typeFilter,
    sortOption,
    timeRange,
    ratingMin,
    ratingMax,
    dateFrom,
    dateTo,
    ageFilter,
  ]);

  const visibleFeedbacks = feedbacks.slice(0, visibleCount);
  const visibleFeedbackUuids = visibleFeedbacks.map((feedback) => feedback.uuid);
  const selectedUnreadCount = feedbacks.filter(
    (feedback) => selectedUuids.has(feedback.uuid) && !feedback.is_read,
  ).length;
  const isBulkActionBusy = isMarkingAsRead || deletingFeedbackUuid !== null;
  const hasUnreadMessages = feedbacks.some((feedback) => !feedback.is_read);

  const handleViewDetails = (uuid: string): void => {
    navigate(`/admin/feedback/${uuid}`);
  };

  // The panel supplies an app-owned review id; this page owns navigation to the manager detail
  // route rather than letting a shared card construct a route.
  const handleGoogleViewDetails = (reviewId: string): void => {
    navigate(`/admin/google-reviews/${reviewId}`);
  };

  const handleSourceChange = (source: FeedbackSource): void => {
    clearSelection();
    setSelectionMode(false);
    // Urgency is Google-specific state, so leaving that source clears it before the next visit.
    // Query parameters seed the initial state only; later filter changes stay local to this page.
    if (source !== 'google-reviews') {
      setAgeFilter('all');
    }
    setActiveSource(source);
  };

  const handleEnterSelectionMode = (): void => {
    setSelectionMode(true);
  };

  const handleExitSelectionMode = (): void => {
    clearSelection();
    setSelectionMode(false);
  };

  const handleViewModeChange = (nextViewMode: FeedbackViewMode): void => {
    if (nextViewMode !== 'card') {
      handleExitSelectionMode();
    }
    setViewMode(nextViewMode);
  };

  const handleOpenDashboard = (): void => {
    // The destination is the manager-only operation dashboard; the panel only exposes the action.
    navigate('/admin/operation');
  };

  return (
    <AdminPage width="standard">
      <FeedbackSourceTabs activeSource={activeSource} onChange={handleSourceChange} />

      <FeedbackFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        hasUnreadNotification={!hasSeenUnread && hasUnreadMessages}
        onUnreadClick={() => setHasSeenUnread(true)}
        typeFilter={typeFilter}
        onTypeChange={setTypeFilter}
        sortOption={sortOption}
        onSortChange={setSortOption}
        toolbarActions={
          activeSource === 'google-reviews' ? (
            <GoogleReviewDashboardAction onClick={handleOpenDashboard} />
          ) : undefined
        }
        additionalFilters={
          activeSource === 'google-reviews' ? (
            <GoogleReviewFilterControls ageFilter={ageFilter} onAgeFilterChange={setAgeFilter} />
          ) : undefined
        }
        rangeFilter={
          <FeedbackRangeFilter
            timeRange={timeRange}
            ratingMin={ratingMin}
            ratingMax={ratingMax}
            dateFrom={dateFrom}
            dateTo={dateTo}
            timeDomain={timeDomain}
            onRangeFiltersChange={(values) => {
              setTimeRange(values.timeRange);
              setDateFrom(values.dateFrom);
              setDateTo(values.dateTo);
              setRatingMin(values.ratingMin);
              setRatingMax(values.ratingMax);
            }}
          />
        }
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        statusLabels={
          activeSource === 'google-reviews'
            ? { all: 'All', unread: 'Unreplied', read: 'Replied' }
            : { all: 'All', unread: 'Pending', read: 'Resolved' }
        }
      />

      {activeSource === 'google-reviews' ? (
        <section
          id="feedback-source-panel-google-reviews"
          role="tabpanel"
          aria-labelledby="feedback-source-tab-google-reviews"
        >
          <GoogleReviewsPanel
            key={viewMode}
            onViewDetails={handleGoogleViewDetails}
            viewMode={viewMode}
            canEditGoogleReviewType={canEditGoogleReviewType}
            searchQuery={searchQuery}
            statusFilter={statusFilter}
            typeFilter={typeFilter}
            sortOption={sortOption}
            timeRange={effectiveTimeRange}
            ratingMin={ratingMin}
            ratingMax={ratingMax}
            dateFrom={dateFrom}
            dateTo={dateTo}
            ageFilter={ageFilter}
          />
        </section>
      ) : (
        <section
          id="feedback-source-panel-internal"
          role="tabpanel"
          aria-labelledby="feedback-source-tab-internal"
        >
          {feedbackError ? (
            <div role="alert" className="type-body py-20 text-center text-status-danger">
              {feedbackError}
            </div>
          ) : (
            <>
              {!loading && (
                <>
                  {feedbackActionMessage && (
                    <div
                      role={feedbackActionMessage.type === 'error' ? 'alert' : 'status'}
                      className={`mb-4 type-body ${feedbackActionMessage.type === 'error' ? 'text-status-danger' : 'text-status-success'}`}
                    >
                      {feedbackActionMessage.text}
                    </div>
                  )}
                  {viewMode === 'card' && (
                    <FeedbackBulkActionBar
                      visibleFeedbackUuids={visibleFeedbackUuids}
                      selectedUuids={selectedUuids}
                      selectionMode={selectionMode}
                      isMarkingAsRead={isMarkingAsRead}
                      isDeletingFeedback={deletingFeedbackUuid !== null}
                      selectedUnreadCount={selectedUnreadCount}
                      onEnterSelectionMode={handleEnterSelectionMode}
                      onExitSelectionMode={handleExitSelectionMode}
                      onToggleVisibleSelection={() => toggleVisibleSelection(visibleFeedbackUuids)}
                      onClearSelection={clearSelection}
                      onMarkReviewed={markReviewed}
                    />
                  )}
                </>
              )}

              <div className="space-y-6">
                {loading ? (
                  <>
                    <LoadingState label="Loading feedback…" variant="section" className="py-2" />
                    <FeedbackLoadingSkeleton viewMode={viewMode} />
                  </>
                ) : (
                  <>
                    {visibleFeedbacks.length > 0 &&
                      (viewMode === 'table' ? (
                        <FeedbackTable
                          feedbacks={visibleFeedbacks}
                          onViewDetails={handleViewDetails}
                        />
                      ) : (
                        visibleFeedbacks.map((feedback) => (
                          <FeedbackCard
                            key={feedback.uuid}
                            feedback={feedback}
                            onViewDetails={() => handleViewDetails(feedback.uuid)}
                            onDelete={() => deleteFeedback(feedback.uuid)}
                            selectionMode={selectionMode}
                            isSelected={selectedUuids.has(feedback.uuid)}
                            isBusy={isBulkActionBusy}
                            isDeleting={deletingFeedbackUuid === feedback.uuid}
                            onToggleSelected={() => toggleSelection(feedback.uuid)}
                          />
                        ))
                      ))}
                    {visibleFeedbacks.length === 0 && (
                      <div className="type-body py-20 text-center text-notice-muted">
                        No feedback matches your criteria.
                      </div>
                    )}
                  </>
                )}
              </div>

              {!loading && visibleCount < feedbacks.length && (
                <div className="mt-8">
                  <button
                    type="button"
                    className="w-full rounded-xl border border-control-border bg-surface-card py-4 type-button text-accent-foreground shadow-sm transition-colors hover:bg-surface-cream hover:text-accent-foreground-hover"
                    onClick={() =>
                      setVisibleCount((previous) => previous + ADMIN_FEEDBACK_PAGE_SIZE)
                    }
                  >
                    Load More Feedback
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </AdminPage>
  );
};
