import { API_BASE_URL } from '../../../shared/api';

/** One KPI rule alert; mirrors KpiAlertView in Backend kpi.alerts.service.ts. */
export interface KpiAlert {
  id: string;
  rule: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  /** Set for "report ready" alerts: the report to open. */
  reportId: string | null;
}

/** Mirrors KpiAlertPage in Backend kpi.alerts.service.ts. */
export interface KpiAlertPage {
  items: KpiAlert[];
  unreadCount: number;
  nextCursor: string | null;
}

interface KpiAlertPageResponse {
  code: number;
  msg: string;
  data: KpiAlertPage;
}

const KPI_ALERTS_API_PATH = `${API_BASE_URL}/admin/kpi-alerts`;

export const fetchKpiAlerts = async (
  limit: number,
  cursor: string | null = null,
): Promise<KpiAlertPage> => {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set('cursor', cursor);
  const response = await fetch(`${KPI_ALERTS_API_PATH}?${params.toString()}`, {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error(`KPI alerts request failed: ${response.status}`);
  }
  const result: KpiAlertPageResponse = await response.json();
  return result.data;
};

export const markKpiAlertRead = async (alertId: string): Promise<void> => {
  const response = await fetch(`${KPI_ALERTS_API_PATH}/${encodeURIComponent(alertId)}/read`, {
    method: 'PATCH',
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error(`KPI alert read request failed: ${response.status}`);
  }
};

export const markAllKpiAlertsRead = async (): Promise<void> => {
  const response = await fetch(`${KPI_ALERTS_API_PATH}/read-all`, {
    method: 'PATCH',
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error(`KPI alerts read-all request failed: ${response.status}`);
  }
};
