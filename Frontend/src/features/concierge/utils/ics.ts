/**
 * An .ics calendar file for the drop-off and pick-up, made in the browser (RFC 5545), so a guest
 * gets a reminder in their own calendar without any email or SMS provider.
 *
 * Times are the facility's wall clock in Auckland, converted to UTC so every calendar app places
 * them correctly without needing a time-zone definition.
 */

export interface StayCalendarInput {
  title: string;
  reference: string;
  startDate: string;
  endDate: string;
  dropOffTime: string;
  pickUpTime: string;
  dropOffLabel: string;
  pickUpLabel: string;
  /** What to bring on drop-off day: added to the drop-off event and shown by its reminder. */
  dropOffReminder?: string;
  /** Used for the event ids and the file's timestamp; injectable for tests. */
  now?: Date;
}

const FACILITY_TIME_ZONE = 'Pacific/Auckland';
const EVENT_MINUTES = 30;

/** Offset of Auckland from UTC at a given instant, in minutes (e.g. +780 in summer). */
const aucklandOffsetMinutes = (instant: Date): number => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: FACILITY_TIME_ZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(instant);
  const value = (type: string): number => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(
    value('year'),
    value('month') - 1,
    value('day'),
    value('hour'),
    value('minute'),
  );
  return Math.round((asUtc - instant.getTime()) / 60_000);
};

/** "2026-10-12" + "09:00" in Auckland, as a real instant (DST handled by a second pass). */
export const aucklandWallClockToUtc = (isoDate: string, time: string): Date => {
  const [year, month, day] = isoDate.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const wallAsUtc = Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1, hour ?? 0, minute ?? 0);
  const firstGuess = new Date(wallAsUtc - aucklandOffsetMinutes(new Date(wallAsUtc)) * 60_000);
  return new Date(wallAsUtc - aucklandOffsetMinutes(firstGuess) * 60_000);
};

const stamp = (date: Date): string =>
  date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');

/** RFC 5545 text escaping: backslash, semicolon, comma and line breaks. */
const escapeText = (text: string): string =>
  text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

const event = (
  uid: string,
  created: Date,
  start: Date,
  summary: string,
  description: string,
  reminder: string,
): string[] => [
  'BEGIN:VEVENT',
  `UID:${uid}`,
  `DTSTAMP:${stamp(created)}`,
  `DTSTART:${stamp(start)}`,
  `DTEND:${stamp(new Date(start.getTime() + EVENT_MINUTES * 60_000))}`,
  `SUMMARY:${escapeText(summary)}`,
  `DESCRIPTION:${escapeText(description)}`,
  'BEGIN:VALARM',
  'ACTION:DISPLAY',
  'TRIGGER:-P1D',
  `DESCRIPTION:${escapeText(reminder)}`,
  'END:VALARM',
  'END:VEVENT',
];

export const buildStayCalendar = (input: StayCalendarInput): string => {
  const created = input.now ?? new Date();
  const description = `${input.title} · ${input.reference}`;
  const dropOffDescription = input.dropOffReminder
    ? `${description}\n${input.dropOffReminder}`
    : description;
  const dropOffReminder = input.dropOffReminder
    ? `${input.dropOffLabel}: ${input.dropOffReminder}`
    : input.dropOffLabel;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Wagstay//Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...event(
      `${input.reference}-drop-off@wagstay`,
      created,
      aucklandWallClockToUtc(input.startDate, input.dropOffTime),
      input.dropOffLabel,
      dropOffDescription,
      dropOffReminder,
    ),
    ...event(
      `${input.reference}-pick-up@wagstay`,
      created,
      aucklandWallClockToUtc(input.endDate, input.pickUpTime),
      input.pickUpLabel,
      description,
      input.pickUpLabel,
    ),
    'END:VCALENDAR',
  ];
  return `${lines.join('\r\n')}\r\n`;
};

/** Offers the file as a download; the guest's device decides which calendar opens it. */
export const downloadCalendar = (fileName: string, content: string): void => {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
};
