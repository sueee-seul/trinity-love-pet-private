import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { UseKpiAlertsResult } from '../hooks/useKpiAlerts';

const formatAlertTime = (createdAt: string): string =>
  new Intl.DateTimeFormat('en-NZ', {
    timeZone: 'Pacific/Auckland',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(createdAt));

/** KPI rule alerts shown at the top of the shared notification window. */
export const KpiAlertSection: React.FC<UseKpiAlertsResult> = ({
  alerts,
  unreadCount,
  loadStatus,
  markRead,
  readAll,
}) => {
  const navigate = useNavigate();
  const hasAlerts = alerts.length > 0;

  return (
    <div className="border-b border-surface-deep">
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <p className="type-eyebrow text-notice-muted">KPI Alerts</p>
        <button
          type="button"
          aria-label="Read all KPI alerts"
          className="shrink-0 rounded-full px-2 py-1 type-button text-accent-foreground transition-colors hover:bg-surface-cream hover:text-accent-foreground-hover focus:outline-none focus:ring-2 focus:ring-focus disabled:cursor-not-allowed disabled:opacity-50"
          disabled={unreadCount === 0}
          onClick={() => void readAll()}
        >
          Read all
        </button>
      </div>

      {loadStatus === 'loading' && !hasAlerts ? (
        <p className="px-4 pb-3 type-body text-notice-muted">Loading KPI alerts…</p>
      ) : loadStatus === 'error' && !hasAlerts ? (
        <p className="px-4 pb-3 type-body text-notice-muted">KPI alerts are unavailable.</p>
      ) : !hasAlerts ? (
        <p className="px-4 pb-3 type-body text-notice-muted">No KPI alerts</p>
      ) : (
        <ul className="max-h-60 overflow-y-auto divide-y divide-surface-deep">
          {alerts.map((alert) => (
            <li key={alert.id}>
              <button
                type="button"
                className={`flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-cream focus:outline-none focus:ring-2 focus:ring-inset focus:ring-focus ${
                  alert.read ? 'bg-surface-card' : 'bg-surface-deep'
                }`}
                onClick={() => {
                  if (!alert.read) {
                    void markRead(alert.id);
                  }
                  navigate('/admin/operation?tab=notifications');
                }}
              >
                <span
                  aria-hidden="true"
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    alert.read ? 'bg-transparent' : 'bg-accent-foreground'
                  }`}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-3">
                    <span
                      className={`block type-body ${
                        alert.read ? 'text-notice-secondary' : 'font-bold text-notice-primary'
                      }`}
                    >
                      {alert.title}
                    </span>
                    <time
                      className="shrink-0 type-meta text-notice-muted"
                      dateTime={alert.createdAt}
                    >
                      {formatAlertTime(alert.createdAt)}
                    </time>
                  </span>
                  {alert.body && (
                    <span className="mt-1 block type-meta text-notice-secondary">{alert.body}</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
