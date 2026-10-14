import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchKpiAlerts,
  markAllKpiAlertsRead,
  markKpiAlertRead,
  type KpiAlert,
} from '../api/kpiAlertsApi';
import {
  loadGoogleReviewNotifications,
  useGoogleReviewNotifications,
} from '../store/googleReviewNotificationStore';
import {
  BOOKING_NOTIFICATION_CATEGORY,
  type ManagerNotification,
} from '../types/googleReviewNotification';
import { formatFeedbackRelativeTime } from '../utils/feedbackTime';
import { KpiReportDialog } from '../components/KpiReportDialog';

const PAGE_SIZE = 20;
const notificationPath = (notification: ManagerNotification): string =>
  notification.category === BOOKING_NOTIFICATION_CATEGORY
    ? '/admin/bookings'
    : `/admin/google-reviews/${encodeURIComponent(notification.target.reviewId)}`;

const formatTime = (value: string): string => {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 'Time unavailable' : formatFeedbackRelativeTime(timestamp);
};

export const AdminNotificationCenterPage: React.FC = () => {
  const navigate = useNavigate();
  const notifications = useGoogleReviewNotifications();
  const [kpiAlerts, setKpiAlerts] = useState<KpiAlert[]>([]);
  const [kpiUnreadCount, setKpiUnreadCount] = useState(0);
  const [kpiCursor, setKpiCursor] = useState<string | null>(null);
  const [kpiStatus, setKpiStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [kpiError, setKpiError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [openReportId, setOpenReportId] = useState<string | null>(null);

  const loadKpiAlerts = useCallback(async (cursor: string | null = null, append = false) => {
    setKpiStatus('loading');
    setKpiError(null);
    try {
      const page = await fetchKpiAlerts(PAGE_SIZE, cursor);
      setKpiAlerts((current) => (append ? [...current, ...page.items] : page.items));
      setKpiUnreadCount(page.unreadCount);
      setKpiCursor(page.nextCursor);
      setKpiStatus('ready');
    } catch {
      setKpiError('KPI alerts could not be loaded. Please try again.');
      setKpiStatus('error');
    }
  }, []);

  useEffect(() => {
    void loadGoogleReviewNotifications(true);
    const timer = window.setTimeout((): void => {
      void loadKpiAlerts();
    }, 0);
    return (): void => {
      window.clearTimeout(timer);
    };
  }, [loadKpiAlerts]);

  const totalUnread = notifications.unreadCount + kpiUnreadCount;
  const feed = useMemo(
    () =>
      [
        ...notifications.items.map((item) => ({ kind: 'notification' as const, item })),
        ...kpiAlerts.map((item) => ({ kind: 'kpi' as const, item })),
      ].sort((a, b) => Date.parse(b.item.createdAt) - Date.parse(a.item.createdAt)),
    [notifications.items, kpiAlerts],
  );
  const hasMore = Boolean(notifications.nextCursor || kpiCursor);

  const markAllRead = async (): Promise<void> => {
    await Promise.all([
      notifications.readAll(),
      markAllKpiAlertsRead().then(() => loadKpiAlerts()),
    ]);
  };

  const loadMore = async (): Promise<void> => {
    setLoadingMore(true);
    try {
      await Promise.all([
        notifications.nextCursor ? notifications.loadMore() : Promise.resolve(),
        kpiCursor ? loadKpiAlerts(kpiCursor, true) : Promise.resolve(),
      ]);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <section className="space-y-6" aria-labelledby="notification-center-title">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="type-eyebrow text-notice-muted">Operations</p>
          <h2 id="notification-center-title" className="type-display text-theme-earth">
            Notification center
          </h2>
          <p className="mt-2 type-body text-notice-secondary">
            Reviews, booking requests, and KPI alerts in one place.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-surface-cream px-3 py-1 type-meta text-notice-secondary">
            {totalUnread} unread
          </span>
          <button
            type="button"
            className="rounded-full border border-border-soft px-4 py-2 type-button text-accent-foreground hover:bg-surface-cream disabled:opacity-50"
            disabled={totalUnread === 0}
            onClick={() => void markAllRead()}
          >
            Mark all as read
          </button>
        </div>
      </header>

      {notifications.error && notifications.items.length > 0 && (
        <p role="alert" className="rounded-xl bg-status-danger/10 p-3 type-meta text-status-danger">
          {notifications.error}
        </p>
      )}
      {kpiError && kpiAlerts.length > 0 && (
        <p role="alert" className="rounded-xl bg-status-danger/10 p-3 type-meta text-status-danger">
          {kpiError}
        </p>
      )}

      {feed.length === 0 && (notifications.status === 'loading' || kpiStatus === 'loading') ? (
        <p
          role="status"
          className="rounded-2xl border border-border-soft bg-surface-card p-8 text-center type-body text-notice-muted"
        >
          Loading notifications…
        </p>
      ) : feed.length === 0 && (notifications.status === 'error' || kpiStatus === 'error') ? (
        <p
          role="alert"
          className="rounded-2xl border border-border-soft bg-surface-card p-8 text-center type-body text-status-danger"
        >
          Notifications are unavailable. Please try again later.
        </p>
      ) : feed.length === 0 ? (
        <div className="rounded-2xl border border-border-soft bg-surface-card p-10 text-center shadow-card">
          <h3 className="type-card-title text-theme-earth">You’re all caught up</h3>
          <p className="mt-2 type-body text-notice-muted">
            New reviews, booking requests, and KPI alerts will appear here.
          </p>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-border-soft bg-surface-card shadow-card divide-y divide-surface-deep">
          {feed.map(({ kind, item }) => {
            const isKpi = kind === 'kpi';
            const isUnread = kind === 'kpi' ? !item.read : item.readAt === null;
            const source =
              kind === 'kpi'
                ? 'KPI alert'
                : item.category === BOOKING_NOTIFICATION_CATEGORY
                  ? 'Booking'
                  : 'Google review';
            const title = item.title;
            const body =
              kind === 'kpi' || item.category === BOOKING_NOTIFICATION_CATEGORY
                ? item.body
                : `${item.body} · ${item.rating}/5 stars`;
            return (
              <li key={`${kind}-${item.id}`}>
                <button
                  type="button"
                  className={`flex w-full gap-4 px-5 py-4 text-left transition-colors hover:bg-surface-cream focus:outline-none focus:ring-2 focus:ring-inset focus:ring-focus ${isUnread ? 'bg-surface-deep/60' : ''}`}
                  onClick={() => {
                    if (isKpi) {
                      const alert = item as KpiAlert;
                      if (isUnread) {
                        void markKpiAlertRead(alert.id).then(() => {
                          setKpiAlerts((current) =>
                            current.map((entry) =>
                              entry.id === alert.id ? { ...entry, read: true } : entry,
                            ),
                          );
                          setKpiUnreadCount((count) => Math.max(0, count - 1));
                        });
                      }
                      if (alert.reportId) setOpenReportId(alert.reportId);
                    } else {
                      const notification = item as ManagerNotification;
                      if (isUnread) void notifications.markRead(notification.id);
                      navigate(notificationPath(notification));
                    }
                  }}
                >
                  <span
                    aria-hidden="true"
                    className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${isUnread ? 'bg-accent-foreground' : 'bg-transparent'}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                      <span className="type-eyebrow text-notice-muted">{source}</span>
                      <time className="type-meta text-notice-muted" dateTime={item.createdAt}>
                        {formatTime(item.createdAt)}
                      </time>
                    </span>
                    <span
                      className={`mt-1 block type-card-title ${isUnread ? 'text-notice-primary' : 'text-notice-secondary'}`}
                    >
                      {title}
                    </span>
                    <span className="mt-1 block type-body text-notice-secondary">{body}</span>
                    {kind !== 'kpi' && item.category !== BOOKING_NOTIFICATION_CATEGORY && (
                      <span className="mt-2 inline-flex rounded-full bg-surface-cream px-2.5 py-1 type-meta text-notice-secondary">
                        {item.reviewerName}
                      </span>
                    )}
                    {isKpi && item.reportId && (
                      <span className="mt-2 block type-meta text-accent-foreground">
                        Open related KPI report →
                      </span>
                    )}
                    {kind !== 'kpi' && item.category === BOOKING_NOTIFICATION_CATEGORY && (
                      <span className="mt-2 block type-meta text-accent-foreground">
                        Open booking requests →
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {hasMore && (
        <div className="text-center">
          <button
            type="button"
            className="rounded-full border border-border-soft px-5 py-2 type-button text-accent-foreground hover:bg-surface-cream disabled:opacity-50"
            disabled={loadingMore}
            onClick={() => void loadMore()}
          >
            {loadingMore ? 'Loading…' : 'Load older notifications'}
          </button>
        </div>
      )}
      <KpiReportDialog reportId={openReportId} onClose={() => setOpenReportId(null)} />
    </section>
  );
};
