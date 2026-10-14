import { format } from 'date-fns';
// Deep imports keep the other locales out of the bundle.
import { enNZ } from 'react-day-picker/locale/en-NZ';
import { zhCN } from 'react-day-picker/locale/zh-CN';

/**
 * Pure helpers for the date and time fields.
 *
 * Every value stays a plain string in the formats a native input would use: "YYYY-MM-DD",
 * "HH:mm" and "YYYY-MM-DDTHH:mm", with "" for empty. Dates are always built from and read as
 * local calendar parts. `toISOString()` is never used, because it converts to UTC and moves a
 * date picked early in the New Zealand morning back to the day before.
 */

export type FieldLocale = 'en' | 'zh';

export interface TimeOption {
  value: string;
  label: string;
}

export interface DateTimeParts {
  date: string;
  time: string;
}

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;
const NOON_HOUR = 12;

export const DATE_FNS_LOCALES = { en: enNZ, zh: zhCN } as const;

// Written out rather than taken from Intl so the text does not depend on the browser's ICU data.
const DATE_LABEL_PATTERNS: Record<FieldLocale, string> = {
  en: 'EEE d MMM yyyy',
  zh: 'yyyy年M月d日 EEE',
};

const padTwo = (part: number): string => String(part).padStart(2, '0');

/** Reads "YYYY-MM-DD" as a local date. Returns null for "" or anything that is not a real day. */
export function parseIsoDate(value: string): Date | null {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  // Date rolls 2026-02-31 over into March; a rolled date means the text was not a real day.
  const isSameDay =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return isSameDay ? date : null;
}

/** Writes a Date as "YYYY-MM-DD" from its local parts. */
export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${padTwo(date.getMonth() + 1)}-${padTwo(date.getDate())}`;
}

/** "Mon 12 Oct 2026" in English, "2026年10月12日 周一" in Chinese, "" when the value is not a date. */
export function formatDateLabel(value: string, locale: FieldLocale): string {
  const date = parseIsoDate(value);
  if (!date) return '';
  return format(date, DATE_LABEL_PATTERNS[locale], { locale: DATE_FNS_LOCALES[locale] });
}

/** Reads "HH:mm" as minutes after midnight. Returns null for "" or an invalid time. */
export function parseTimeToMinutes(value: string): number | null {
  const match = TIME_PATTERN.exec(value);
  if (!match) return null;
  return Number(match[1]) * MINUTES_PER_HOUR + Number(match[2]);
}

/** Writes minutes after midnight as "HH:mm". */
export function minutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
  return `${padTwo(hours)}:${padTwo(totalMinutes % MINUTES_PER_HOUR)}`;
}

/** "9:00 am" / "12:30 pm" in English, "上午9:00" / "下午12:30" in Chinese, "" when invalid. */
export function formatTimeLabel(value: string, locale: FieldLocale): string {
  const totalMinutes = parseTimeToMinutes(value);
  if (totalMinutes === null) return '';
  const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
  const clock = `${hours % NOON_HOUR || NOON_HOUR}:${padTwo(totalMinutes % MINUTES_PER_HOUR)}`;
  const isMorning = hours < NOON_HOUR;
  if (locale === 'zh') return `${isMorning ? '上午' : '下午'}${clock}`;
  return `${clock} ${isMorning ? 'am' : 'pm'}`;
}

export interface TimeOptionsInput {
  locale: FieldLocale;
  stepMinutes: number;
  from: string;
  /** Last slot to offer. Omit it to run to the last step of the day. */
  to?: string;
  /** The field's current value. A valid time that is not on the grid is kept as an extra option. */
  current?: string;
}

/** Builds the time choices from `from` to `to` in `stepMinutes` steps, in time order. */
export function buildTimeOptions({
  locale,
  stepMinutes,
  from,
  to,
  current = '',
}: TimeOptionsInput): TimeOption[] {
  // A zero or negative step would never reach `to`, so fall back to one slot per hour.
  const step = stepMinutes > 0 ? stepMinutes : MINUTES_PER_HOUR;
  const start = parseTimeToMinutes(from) ?? 0;
  const end = parseTimeToMinutes(to ?? '') ?? MINUTES_PER_DAY - step;
  const minutes: number[] = [];
  for (let slot = start; slot <= end && slot < MINUTES_PER_DAY; slot += step) {
    minutes.push(slot);
  }
  const currentMinutes = parseTimeToMinutes(current);
  if (currentMinutes !== null && !minutes.includes(currentMinutes)) {
    minutes.push(currentMinutes);
    minutes.sort((first, second) => first - second);
  }
  return minutes.map((slot) => {
    const value = minutesToTime(slot);
    return { value, label: formatTimeLabel(value, locale) };
  });
}

/** Splits "YYYY-MM-DDTHH:mm" into its parts. Anything else gives two empty parts. */
export function splitDateTime(value: string): DateTimeParts {
  const [date = '', time = ''] = value.split('T');
  if (!parseIsoDate(date) || parseTimeToMinutes(time) === null) return { date: '', time: '' };
  return { date, time };
}

/** Joins the parts into "YYYY-MM-DDTHH:mm", or "" until both parts are filled in. */
export function joinDateTime({ date, time }: DateTimeParts): string {
  if (!parseIsoDate(date) || parseTimeToMinutes(time) === null) return '';
  return `${date}T${time}`;
}

/** The date part of a "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm" bound, so a calendar can use either. */
export function toDatePart(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const [date = ''] = value.split('T');
  return parseIsoDate(date) ? date : undefined;
}
