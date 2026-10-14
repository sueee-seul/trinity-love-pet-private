import type { PortalLocale } from '../../i18n/portalLocale';
import { formatCompactRange, formatDay } from '../../utils/home';

// Chinese days are written "9月27日". English keeps the homepage's own "27 Sep", because Intl's
// en-NZ month reads "Sept" in newer ICU.
const CHINESE_DAY_FORMAT = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric' });

const WEEKDAY_FORMATS: Record<PortalLocale, Intl.DateTimeFormat> = {
  en: new Intl.DateTimeFormat('en-NZ', { weekday: 'short' }),
  zh: new Intl.DateTimeFormat('zh-CN', { weekday: 'short' }),
};

// The facility's clock, not the viewer's: a dose due at 8:00 am is due at 8:00 am in Auckland,
// wherever the parent reads the page from.
const AUCKLAND_TIME_FORMATS: Record<PortalLocale, Intl.DateTimeFormat> = {
  en: new Intl.DateTimeFormat('en-NZ', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Pacific/Auckland',
  }),
  zh: new Intl.DateTimeFormat('zh-CN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Pacific/Auckland',
  }),
};

/** "8:05 am" or "上午8:05": the Auckland wall time of an ISO instant. */
export function formatAucklandTime(iso: string, locale: PortalLocale = 'en'): string {
  return AUCKLAND_TIME_FORMATS[locale].format(new Date(iso));
}

// en-CA writes a date as 'YYYY-MM-DD', the form the server uses for the day of an update.
const AUCKLAND_DAY_FORMAT = new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland' });
const AUCKLAND_HOUR_FORMAT = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  hourCycle: 'h23',
  timeZone: 'Pacific/Auckland',
});

/** The facility's calendar day at `now`, 'YYYY-MM-DD', which is the day a daily update is for. */
export function aucklandIsoDate(now: Date): string {
  return AUCKLAND_DAY_FORMAT.format(now);
}

/** The hour (0 to 23) on the facility's clock at `now`. */
export function aucklandHour(now: Date): number {
  return Number(AUCKLAND_HOUR_FORMAT.format(now));
}

/** Parses a plain 'YYYY-MM-DD' as a calendar date rather than an instant, because
 * `new Date('2026-09-15')` would read as UTC midnight and can render as the
 * previous day in a negative-offset timezone. */
export function toLocalDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
}

/** The viewer's own calendar day as 'YYYY-MM-DD', the format the live care API uses for days. */
export function localIsoDate(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** "27 Sep" or "9月27日", from a 'YYYY-MM-DD' day. */
export function formatCareDay(isoDate: string, locale: PortalLocale = 'en'): string {
  const day = toLocalDate(isoDate);
  return locale === 'zh' ? CHINESE_DAY_FORMAT.format(day) : formatDay(day.toISOString());
}

/** "Mon" or "周一", from a 'YYYY-MM-DD' day. */
export function formatCareWeekday(isoDate: string, locale: PortalLocale = 'en'): string {
  return WEEKDAY_FORMATS[locale].format(toLocalDate(isoDate));
}

/** "27 Sep to 2 Oct", or "12 to 16 Sep" within one month, from two 'YYYY-MM-DD' days. Written
 * the same way as the stay dates on the homepage. In Chinese: "9月27日至10月2日", "9月12日至16日". */
export function formatStayDates(
  dropOffDate: string,
  pickUpDate: string,
  locale: PortalLocale = 'en',
): string {
  const start = toLocalDate(dropOffDate);
  const end = toLocalDate(pickUpDate);
  if (locale === 'en') return formatCompactRange(start.toISOString(), end.toISOString());

  const sameMonth =
    start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const endLabel = sameMonth ? `${end.getDate()}日` : CHINESE_DAY_FORMAT.format(end);
  return `${CHINESE_DAY_FORMAT.format(start)}至${endLabel}`;
}
