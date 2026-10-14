import {
  GOOGLE_REVIEW_DASHBOARD_PLACE_SLUG,
  GOOGLE_REVIEW_DASHBOARD_TIME_ZONE,
  type AdminGoogleReviewDashboardQuery,
} from '../contracts/google.review.dashboard.contract.js';

interface ZonedDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

interface CalendarMonth {
  year: number;
  month: number;
}

/**
 * Represents the resolved start and end bounds for the Google review dashboard query.
 */
export interface GoogleReviewDashboardPeriod {
  start: Date;
  end: Date;
}

export interface GoogleReviewDashboardSummaryPeriods {
  last_7_days: GoogleReviewDashboardPeriod;
  last_30_days: GoogleReviewDashboardPeriod;
  last_12_months: GoogleReviewDashboardPeriod;
}

const ZONED_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: GOOGLE_REVIEW_DASHBOARD_TIME_ZONE,
  calendar: 'iso8601',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const getZonedDateParts = (value: Date): ZonedDateParts => {
  const parts = ZONED_DATE_TIME_FORMATTER.formatToParts(value);
  const getPart = (type: Intl.DateTimeFormatPartTypes): number => {
    const part = parts.find((entry) => entry.type === type)?.value;
    if (!part) {
      throw new Error(`Could not resolve ${type} in ${GOOGLE_REVIEW_DASHBOARD_TIME_ZONE}`);
    }
    return Number(part);
  };

  return {
    year: getPart('year'),
    month: getPart('month'),
    day: getPart('day'),
    hour: getPart('hour'),
    minute: getPart('minute'),
    second: getPart('second'),
  };
};

const getZonedOffsetMilliseconds = (value: Date): number => {
  const parts = getZonedDateParts(value);
  const zonedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return zonedAsUtc - value.getTime();
};

const createZonedMidnight = (year: number, month: number, day: number): Date => {
  const utcMidnight = Date.UTC(year, month - 1, day);
  let result = new Date(utcMidnight);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    result = new Date(utcMidnight - getZonedOffsetMilliseconds(result));
  }

  return result;
};

const parseDateOnly = (value: string): { year: number; month: number; day: number } => {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) {
    throw new Error(`Invalid dashboard date: ${value}`);
  }
  return { year, month, day };
};

const addOneCalendarDay = (date: CalendarDate): CalendarDate => {
  const nextDate = new Date(Date.UTC(date.year, date.month - 1, date.day + 1));
  return {
    year: nextDate.getUTCFullYear(),
    month: nextDate.getUTCMonth() + 1,
    day: nextDate.getUTCDate(),
  };
};

const shiftCalendarDate = (date: CalendarDate, offset: number): CalendarDate => {
  const shiftedDate = new Date(Date.UTC(date.year, date.month - 1, date.day + offset));
  return {
    year: shiftedDate.getUTCFullYear(),
    month: shiftedDate.getUTCMonth() + 1,
    day: shiftedDate.getUTCDate(),
  };
};

const createZonedMidnightFromCalendarDate = (date: CalendarDate): Date =>
  createZonedMidnight(date.year, date.month, date.day);

const shiftMonth = (year: number, month: number, offset: number): CalendarMonth => {
  const monthIndex = year * 12 + (month - 1) + offset;
  return {
    year: Math.floor(monthIndex / 12),
    month: (((monthIndex % 12) + 12) % 12) + 1,
  };
};

/**
 * Resolves the query parameters into a definitive time period.
 *
 * @remarks
 * Ensures the dashboard boundaries align correctly with the configured timezone and default historical scopes.
 */
export const resolveGoogleReviewDashboardPeriod = (
  query: AdminGoogleReviewDashboardQuery,
  now: Date,
): GoogleReviewDashboardPeriod => {
  if (query.from && query.to) {
    const from = parseDateOnly(query.from);
    const to = parseDateOnly(query.to);
    const nextDay = addOneCalendarDay(to);
    return {
      start: createZonedMidnight(from.year, from.month, from.day),
      end: createZonedMidnight(nextDay.year, nextDay.month, nextDay.day),
    };
  }

  const current = getZonedDateParts(now);
  const periodStartMonth = shiftMonth(current.year, current.month, -11);
  return {
    start: createZonedMidnight(periodStartMonth.year, periodStartMonth.month, 1),
    end: now,
  };
};

/**
 * Resolves all summary windows from one Auckland calendar date so the selector
 * remains a read-only projection of the same snapshot.
 */
export const resolveGoogleReviewDashboardSummaryPeriods = (
  now: Date,
): GoogleReviewDashboardSummaryPeriods => {
  const current = getZonedDateParts(now);
  const today = { year: current.year, month: current.month, day: current.day };
  const tomorrow = shiftCalendarDate(today, 1);
  const endOfToday = createZonedMidnightFromCalendarDate(tomorrow);
  const lastTwelveMonths = resolveGoogleReviewDashboardPeriod(
    { placeSlug: GOOGLE_REVIEW_DASHBOARD_PLACE_SLUG },
    now,
  );

  return {
    last_7_days: {
      start: createZonedMidnightFromCalendarDate(shiftCalendarDate(today, -6)),
      end: endOfToday,
    },
    last_30_days: {
      start: createZonedMidnightFromCalendarDate(shiftCalendarDate(today, -29)),
      end: endOfToday,
    },
    last_12_months: {
      start: lastTwelveMonths.start,
      end: lastTwelveMonths.end,
    },
  };
};
