import type { PortalLocale } from '../../i18n/portalLocale';

// Written out rather than taken from `toLocaleDateString('en-NZ')`, which prints "Sept" in newer
// ICU builds. The homepage writes months the same way (utils/home.ts), so both pages read alike.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function dayMonth(date: Date, locale: PortalLocale): string {
  return locale === 'zh'
    ? `${date.getMonth() + 1}月${date.getDate()}日`
    : `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/** "2026年9月12日" in Chinese, "12 Sep 2026" in English. */
function dayMonthYear(date: Date, locale: PortalLocale): string {
  return locale === 'zh'
    ? `${date.getFullYear()}年${dayMonth(date, locale)}`
    : `${dayMonth(date, locale)} ${date.getFullYear()}`;
}

/** Formats a stay's drop-off/pick-up range like "12 to 16 Sep 2026" or "28 Sep to 2 Oct 2026"
 * ("2026年9月12日至16日" in Chinese): the month and the year are written once when both ends
 * share them. Both inputs are absolute ISO timestamps; formatting renders them in the viewer's
 * local timezone. */
export function formatDateRange(
  dropOffAt: string,
  pickUpAt: string,
  locale: PortalLocale = 'en',
): string {
  const start = new Date(dropOffAt);
  const end = new Date(pickUpAt);
  if (locale === 'zh') {
    if (start.getFullYear() !== end.getFullYear()) {
      return `${dayMonthYear(start, locale)}至${dayMonthYear(end, locale)}`;
    }
    const endPart =
      start.getMonth() !== end.getMonth() ? dayMonth(end, locale) : `${end.getDate()}日`;
    return `${dayMonthYear(start, locale)}至${endPart}`;
  }

  const endLabel = dayMonthYear(end, locale);
  if (start.getFullYear() !== end.getFullYear()) {
    return `${dayMonthYear(start, locale)} to ${endLabel}`;
  }
  if (start.getMonth() !== end.getMonth()) {
    return `${dayMonth(start, locale)} to ${endLabel}`;
  }
  return `${start.getDate()} to ${endLabel}`;
}

const TIME_FORMATS: Readonly<Record<PortalLocale, Intl.DateTimeFormat>> = {
  en: new Intl.DateTimeFormat('en-NZ', { hour: 'numeric', minute: '2-digit' }),
  zh: new Intl.DateTimeFormat('zh-CN', { hour: 'numeric', minute: '2-digit', hour12: true }),
};

/** Formats the time of an ISO timestamp like "2:00 pm" ("下午2:00"), for a row that already
 * names the date. */
export function formatTime(iso: string, locale: PortalLocale = 'en'): string {
  return TIME_FORMATS[locale].format(new Date(iso));
}

/** Formats a single ISO timestamp like "12 Sep 2026, 2:00 pm" ("2026年9月12日 下午2:00"). Used in
 * the booking details modal for drop-off, pick-up, and the created date. */
export function formatDateTime(iso: string, locale: PortalLocale = 'en'): string {
  const date = new Date(iso);
  const separator = locale === 'zh' ? ' ' : ', ';
  return `${dayMonthYear(date, locale)}${separator}${TIME_FORMATS[locale].format(date)}`;
}
