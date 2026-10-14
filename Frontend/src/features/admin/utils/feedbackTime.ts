const FEEDBACK_TIME_ZONE = 'Pacific/Auckland';
const CALENDAR_DATE_PARTS = ['year', 'month', 'day'] as const;
type CalendarDatePart = (typeof CALENDAR_DATE_PARTS)[number];

const feedbackCalendarDateFormatter = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: FEEDBACK_TIME_ZONE,
});

const feedbackCalendarDateLabelFormatter = new Intl.DateTimeFormat('en-NZ', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: FEEDBACK_TIME_ZONE,
});

const feedbackTimeFormatter = new Intl.DateTimeFormat('en-NZ', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
  timeZone: FEEDBACK_TIME_ZONE,
});

export const formatFeedbackCalendarDate = (timestamp: number): string => {
  const dateParts: Record<CalendarDatePart, string> = {
    year: '',
    month: '',
    day: '',
  };

  for (const part of feedbackCalendarDateFormatter.formatToParts(timestamp)) {
    if (CALENDAR_DATE_PARTS.includes(part.type as CalendarDatePart)) {
      dateParts[part.type as CalendarDatePart] = part.value;
    }
  }

  return `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
};

/**
 * Encodes an Auckland calendar date as a UTC-midnight day value for the range slider.
 * This is a calendar-day ordinal, not the instant at which the local day begins.
 */
export const toFeedbackCalendarDayTimestamp = (date: string): number => {
  const timestamp = Date.parse(`${date}T00:00:00Z`);
  return Number.isNaN(timestamp) ? Date.now() : timestamp;
};

export const formatFeedbackCalendarDateLabel = (date: string): string => {
  return feedbackCalendarDateLabelFormatter.format(toFeedbackCalendarDayTimestamp(date));
};

export const formatFeedbackSubmissionTime = (timestamp: number): string => {
  return feedbackTimeFormatter.format(timestamp);
};

export const formatFeedbackRelativeTime = (timestamp: number, now = Date.now()): string => {
  const elapsedSeconds = Math.max(0, Math.floor((now - timestamp) / 1000));

  if (elapsedSeconds < 60) {
    return 'just now';
  }

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes < 60) {
    return `${elapsedMinutes}m ago`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return `${elapsedHours}h ago`;
  }

  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays < 30) {
    return `${elapsedDays}d ago`;
  }

  const elapsedMonths = Math.floor(elapsedDays / 30);
  if (elapsedMonths < 12) {
    return `${elapsedMonths}mo ago`;
  }

  return `${Math.floor(elapsedMonths / 12)}y ago`;
};
