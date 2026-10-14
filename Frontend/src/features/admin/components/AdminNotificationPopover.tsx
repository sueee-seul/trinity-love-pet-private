import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { NotificationPopover } from '../../../shared/components/ui/NotificationPopover';
import {
  loadGoogleReviewNotifications,
  useGoogleReviewNotifications,
} from '../store/googleReviewNotificationStore';
import {
  BOOKING_NOTIFICATION_CATEGORY,
  type ManagerNotification,
} from '../types/googleReviewNotification';
import { useKpiAlerts } from '../hooks/useKpiAlerts';
import { KpiAlertSection } from './KpiAlertSection';
import { formatFeedbackRelativeTime } from '../utils/feedbackTime';

// The bell lists Google Review receipts and "New booking request" notices; each names its source
// and opens the page where the manager acts on it.
const NOTIFICATION_SOURCE_LABELS: Record<ManagerNotification['category'], string> = {
  google_review: 'Google Reviews',
  booking: 'Bookings',
};

const BOOKINGS_PATH = '/admin/bookings';

const notificationPath = (notification: ManagerNotification): string =>
  notification.category === BOOKING_NOTIFICATION_CATEGORY
    ? BOOKINGS_PATH
    : `/admin/google-reviews/${encodeURIComponent(notification.target.reviewId)}`;

/**
 * Refreshes the list each time the bell opens. Review receipts also arrive over the review event
 * stream; a booking request has no stream, so the store also refreshes on an interval.
 */
const RefreshWhenOpened: React.FC = () => {
  useEffect(() => {
    void loadGoogleReviewNotifications(true);
  }, []);
  return null;
};

const formatNotificationTime = (createdAt: string): string => {
  const timestamp = Date.parse(createdAt);
  return Number.isNaN(timestamp) ? 'Time unavailable' : formatFeedbackRelativeTime(timestamp);
};

export const AdminNotificationPopover: React.FC = () => {
  const navigate = useNavigate();
  const { items, unreadCount, nextCursor, status, error, loadMore, markRead, readAll } =
    useGoogleReviewNotifications();
  const kpiAlerts = useKpiAlerts();

  const handleNotificationClick = (notification: ManagerNotification, isUnread: boolean): void => {
    if (isUnread) {
      void markRead(notification.id);
    }
    navigate(notificationPath(notification));
  };

  const hasItems = items.length > 0;
  const isInitialLoading = status === 'loading' && !hasItems;

  return (
    <NotificationPopover
      notificationCount={unreadCount + kpiAlerts.unreadCount}
      popoverId="admin-notification-list"
      openOnHover={false}
    >
      <div className="w-full overflow-hidden rounded-2xl border border-border-soft bg-surface-card shadow-xl">
        <RefreshWhenOpened />
        <KpiAlertSection {...kpiAlerts} />
        <div className="flex items-center justify-between gap-4 border-b border-surface-deep px-4 py-3">
          <div>
            <p className="type-eyebrow text-notice-muted">Reviews and bookings</p>
            <h2 className="type-card-title">Notifications</h2>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-full px-2 py-1 type-button text-accent-foreground transition-colors hover:bg-surface-cream hover:text-accent-foreground-hover focus:outline-none focus:ring-2 focus:ring-focus disabled:cursor-not-allowed disabled:opacity-50"
            disabled={unreadCount === 0 || status === 'loading'}
            onClick={() => void readAll()}
          >
            Read all
          </button>
        </div>

        {error && hasItems && (
          <p
            role="alert"
            className="border-b border-surface-deep px-4 py-2 type-meta text-status-danger"
          >
            {error}
          </p>
        )}

        {isInitialLoading ? (
          <p role="status" className="px-4 py-6 type-body text-notice-muted">
            Loading notifications…
          </p>
        ) : status === 'error' && !hasItems ? (
          <p role="alert" className="px-4 py-6 type-body text-status-danger">
            {error ?? 'Notifications are unavailable.'}
          </p>
        ) : !hasItems ? (
          <p className="px-4 py-6 type-body text-notice-muted">No new notifications</p>
        ) : (
          <>
            <ul className="max-h-[min(28rem,calc(100vh-8rem))] overflow-y-auto divide-y divide-surface-deep">
              {items.map((notification) => {
                const isUnread = notification.readAt === null;
                return (
                  <li key={notification.id}>
                    <button
                      type="button"
                      className={`flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-cream focus:outline-none focus:ring-2 focus:ring-inset focus:ring-focus ${
                        isUnread ? 'bg-surface-deep' : 'bg-surface-card'
                      }`}
                      onClick={() => handleNotificationClick(notification, isUnread)}
                    >
                      <span
                        aria-hidden="true"
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                          isUnread ? 'bg-accent-foreground' : 'bg-transparent'
                        }`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-3">
                          <span className="type-eyebrow text-notice-muted">
                            {NOTIFICATION_SOURCE_LABELS[notification.category]}
                          </span>
                          <time
                            className="shrink-0 type-meta text-notice-muted"
                            dateTime={notification.createdAt}
                          >
                            {formatNotificationTime(notification.createdAt)}
                          </time>
                        </span>
                        <span
                          className={`mt-1 block type-body ${
                            isUnread ? 'font-bold text-notice-primary' : 'text-notice-secondary'
                          }`}
                        >
                          {notification.title}
                        </span>
                        <span className="mt-1 block type-meta text-notice-secondary">
                          {notification.body}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {nextCursor && (
              <button
                type="button"
                className="w-full border-t border-surface-deep px-4 py-2 type-button text-accent-foreground transition-colors hover:bg-surface-cream hover:text-accent-foreground-hover focus:outline-none focus:ring-2 focus:ring-inset focus:ring-focus"
                onClick={() => void loadMore()}
              >
                Load more
              </button>
            )}
          </>
        )}
      </div>
    </NotificationPopover>
  );
};
