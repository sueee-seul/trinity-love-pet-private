import type { ConciergeCopy, DateProblem } from '../copy';
import type { ConciergeLocale } from '../types';

/**
 * Formatting for money and dates on the concierge page. Amounts always come from the server; this
 * only displays them, in New Zealand dollars with the GST share shown the way NZ receipts show it.
 */

const NZD = new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' });

export const formatNzd = (amount: number): string => NZD.format(amount);

/**
 * The GST contained in a GST-inclusive NZ price: 15% GST means GST is 3/23 of the total.
 * Displayed as "includes GST of $X" so the single total stays the headline price.
 */
export const gstIncluded = (gstInclusiveTotal: number): number =>
  Math.round(((gstInclusiveTotal * 3) / 23) * 100) / 100;

const localeTag = (locale: ConciergeLocale): string => (locale === 'zh' ? 'zh-CN' : 'en-NZ');

/** Today's calendar date where the facility is, as the Backend decides what "in the past" means. */
export const todayInNewZealand = (now: Date = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland' }).format(now);

const toUtcDate = (isoDate: string): Date => {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
};

export const addDays = (isoDate: string, days: number): string => {
  const date = toUtcDate(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

/**
 * "Mon 12 Oct" / "10月12日周一", with the year added when it is not this year, so a date that
 * rolled into next year is never mistaken for this one. Read from the ISO date without shifting
 * it through a time zone.
 */
export const formatShortDate = (
  isoDate: string,
  locale: ConciergeLocale,
  today: string = todayInNewZealand(),
): string => {
  const showYear = isoDate.slice(0, 4) !== today.slice(0, 4);
  const text = new Intl.DateTimeFormat(localeTag(locale), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(showYear ? { year: 'numeric' as const } : {}),
    timeZone: 'UTC',
  }).format(toUtcDate(isoDate));
  return locale === 'en' ? text.replace(',', '') : text;
};

/** "Mon 12 Oct and Tue 13 Oct" / "10月12日周一、10月13日周二". */
export const formatDateList = (
  isoDates: string[],
  locale: ConciergeLocale,
  today?: string,
): string => {
  const names = isoDates.map((isoDate) => formatShortDate(isoDate, locale, today));
  if (locale === 'zh' || names.length < 2) return names.join('、');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
};

export const formatDateRange = (
  startDate: string,
  endDate: string,
  locale: ConciergeLocale,
  today?: string,
): string =>
  `${formatShortDate(startDate, locale, today)}${locale === 'en' ? ' to ' : ' 至 '}${formatShortDate(endDate, locale, today)}`;

/** Local clock time for a timestamp, e.g. a quote's expiry. */
export const formatClockTime = (isoTimestamp: string, locale: ConciergeLocale): string =>
  new Intl.DateTimeFormat(localeTag(locale), { hour: 'numeric', minute: '2-digit' }).format(
    new Date(isoTimestamp),
  );

/** Nights between two ISO dates, matching the Backend's pricing rule (minimum one night). */
export const nightsBetween = (startDate: string, endDate: string): number => {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  return Math.max(Math.round((end - start) / 86_400_000), 1);
};

/** Mirrors the Backend's CONCIERGE_MAX_STAY_NIGHTS. */
export const MAX_ONLINE_NIGHTS = 60;

/**
 * Why a chosen pair of dates cannot be quoted, mirroring the Backend's `hasBookableDates`, so the
 * page can say "pick-up must be after drop-off" instead of a bare "still needed: dates".
 */
export const dateProblem = (
  startDate: string | null,
  endDate: string | null,
  today: string = todayInNewZealand(),
): DateProblem | null => {
  if (!startDate || !endDate) return null;
  if (startDate < today) return 'in_past';
  if (endDate <= startDate) return 'end_before_start';
  return nightsBetween(startDate, endDate) > MAX_ONLINE_NIGHTS ? 'too_long' : null;
};

/** A catalogue price unit in the page's language; an unknown unit shows nothing, not raw English. */
export const priceUnitLabel = (copy: ConciergeCopy, priceUnit: string): string =>
  copy.packages.units[priceUnit.trim().toLowerCase()] ?? '';
