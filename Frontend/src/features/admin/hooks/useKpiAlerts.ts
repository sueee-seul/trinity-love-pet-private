import { useCallback, useEffect, useState } from 'react';
import {
  fetchKpiAlerts,
  markAllKpiAlertsRead,
  markKpiAlertRead,
  type KpiAlert,
  type KpiAlertPage,
} from '../api/kpiAlertsApi.js';

/** Alerts are checked every 30 minutes on the server, so polling every minute is enough. */
const POLL_INTERVAL_MS = 60_000;
/** The bell shows the newest few; a full list belongs to the future notifications page. */
const BELL_ALERT_LIMIT = 5;

export type KpiAlertsLoadStatus = 'loading' | 'loaded' | 'error';

export interface UseKpiAlertsResult {
  alerts: KpiAlert[];
  unreadCount: number;
  loadStatus: KpiAlertsLoadStatus;
  markRead: (alertId: string) => Promise<void>;
  readAll: () => Promise<void>;
}

export const useKpiAlerts = (): UseKpiAlertsResult => {
  const [alerts, setAlerts] = useState<KpiAlert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadStatus, setLoadStatus] = useState<KpiAlertsLoadStatus>('loading');

  const applyPage = useCallback((page: KpiAlertPage): void => {
    setAlerts(page.items);
    setUnreadCount(page.unreadCount);
    setLoadStatus('loaded');
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      applyPage(await fetchKpiAlerts(BELL_ALERT_LIMIT));
    } catch {
      setLoadStatus('error');
    }
  }, [applyPage]);

  useEffect(() => {
    const load = (): void => {
      fetchKpiAlerts(BELL_ALERT_LIMIT)
        .then(applyPage)
        .catch(() => setLoadStatus('error'));
    };
    load();
    const timer = window.setInterval(load, POLL_INTERVAL_MS);
    return (): void => window.clearInterval(timer);
  }, [applyPage]);
  const markRead = useCallback(
    async (alertId: string): Promise<void> => {
      await markKpiAlertRead(alertId);
      await refresh();
    },
    [refresh],
  );
  const readAll = useCallback(async (): Promise<void> => {
    await markAllKpiAlertsRead();
    await refresh();
  }, [refresh]);

  return { alerts, unreadCount, loadStatus, markRead, readAll };
};
