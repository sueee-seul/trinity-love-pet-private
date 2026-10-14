import { Types } from 'mongoose';
import { getAlertLogModel } from '../mongodb/kpi-reports/alert-log.model.js';
import {
  getKpiMongoConnection,
  isKpiMongoConfigured,
} from '../mongodb/kpi-reports/kpi.mongo.connection.js';
import { findScheduledTaskKpiRecordsBetween } from '../repositories/kpi.repository.js';
import { evaluateKpiAlertRules, type KpiAlertRule } from './kpi.alerts.rules.js';
import { toAucklandDateString } from './kpi.daily-summary.service.js';
import { addDays } from './kpi.summary.service.js';

const toAucklandHour = (now: Date): number =>
  Number(
    new Intl.DateTimeFormat('en-NZ', {
      timeZone: 'Pacific/Auckland',
      hour: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .find((part) => part.type === 'hour')?.value,
  );

/**
 * Checks today's tasks and saves new alerts to alert_logs. A rule + subject that already alerted
 * today is saved again only when its severity grew. Returns how many alerts were saved.
 */
export const runKpiAlertChecks = async (now: Date = new Date()): Promise<number> => {
  const today = toAucklandDateString(now);
  const tasks = await findScheduledTaskKpiRecordsBetween(today, addDays(today, 1));
  const candidates = evaluateKpiAlertRules(tasks, now, toAucklandHour(now));
  if (candidates.length === 0) {
    return 0;
  }

  const AlertLog = getAlertLogModel(await getKpiMongoConnection());
  let created = 0;
  for (const candidate of candidates) {
    const latest = await AlertLog.findOne({
      date: today,
      rule: candidate.rule,
      subject: candidate.subject,
    })
      .sort({ createdAt: -1 })
      .lean();
    if (latest && candidate.severity <= latest.severity) {
      continue;
    }
    await AlertLog.create({ ...candidate, date: today, readBy: [] });
    created += 1;
  }
  return created;
};

export interface KpiAlertView {
  id: string;
  rule: KpiAlertRule;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  reportId: string | null;
}

export interface KpiAlertPage {
  items: KpiAlertView[];
  unreadCount: number;
  nextCursor: string | null;
}

const EMPTY_PAGE: KpiAlertPage = { items: [], unreadCount: 0, nextCursor: null };

/** Newest alerts first, with read state for this manager. Shaped for the bell and a future page. */
export const listKpiAlerts = async (
  userId: string,
  limit: number,
  cursor?: string,
): Promise<KpiAlertPage> => {
  if (!isKpiMongoConfigured()) {
    return EMPTY_PAGE;
  }
  const AlertLog = getAlertLogModel(await getKpiMongoConnection());
  const filter = cursor ? { _id: { $lt: new Types.ObjectId(cursor) } } : {};
  const [docs, unreadCount] = await Promise.all([
    AlertLog.find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean(),
    AlertLog.countDocuments({ readBy: { $ne: userId } }),
  ]);
  const page = docs.slice(0, limit);
  const last = page.at(-1);

  return {
    items: page.map((doc) => ({
      id: String(doc._id),
      rule: doc.rule,
      title: doc.title,
      body: doc.body,
      createdAt: new Date(doc.createdAt).toISOString(),
      read: doc.readBy.includes(userId),
      reportId: doc.reportId ?? null,
    })),
    unreadCount,
    nextCursor: docs.length > limit && last ? String(last._id) : null,
  };
};

export const markKpiAlertRead = async (userId: string, alertId: string): Promise<void> => {
  if (!isKpiMongoConfigured()) {
    return;
  }
  const AlertLog = getAlertLogModel(await getKpiMongoConnection());
  await AlertLog.updateOne({ _id: new Types.ObjectId(alertId) }, { $addToSet: { readBy: userId } });
};

export const markAllKpiAlertsRead = async (userId: string): Promise<void> => {
  if (!isKpiMongoConfigured()) {
    return;
  }
  const AlertLog = getAlertLogModel(await getKpiMongoConnection());
  await AlertLog.updateMany({ readBy: { $ne: userId } }, { $addToSet: { readBy: userId } });
};
