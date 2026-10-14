import type { PortalLocale } from '../i18n/portalLocale';

/** The calendar each portal language writes dates and times in. */
const DATE_LOCALE: Record<PortalLocale, string> = { en: 'en-US', zh: 'zh-CN' };

const TODAY_LABEL: Record<PortalLocale, string> = { en: 'Today', zh: '今天' };

export function formatTime(iso: string, locale: PortalLocale = 'en'): string {
  return new Date(iso).toLocaleTimeString(DATE_LOCALE[locale], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatDayLabel(iso: string, locale: PortalLocale = 'en'): string {
  const date = new Date(iso);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  if (isToday) {
    return TODAY_LABEL[locale];
  }
  return date.toLocaleDateString(DATE_LOCALE[locale], { month: 'short', day: 'numeric' });
}

export function isoAt(hour: number, minute: number, daysAgo = 0): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}
