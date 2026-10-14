/**
 * The facility is in New Zealand, so a drop-off at "2026-10-12 09:00" means 9am in Auckland, not
 * 9am wherever the server happens to run. `new Date('2026-10-12T09:00:00')` uses the host's zone,
 * which on a UTC host shifts every booking by 12-13 hours; this converts explicitly instead,
 * including the daylight-saving changeovers.
 */

export const NEW_ZEALAND_TIME_ZONE = 'Pacific/Auckland';

const partsFormatter = new Intl.DateTimeFormat('en-NZ', {
  timeZone: NEW_ZEALAND_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/** The Auckland wall-clock parts of an instant, zero-padded: year, month, day, hour, minute… */
const newZealandPartsOf = (instant: Date): Partial<Record<Intl.DateTimeFormatPartTypes, string>> =>
  Object.fromEntries(partsFormatter.formatToParts(instant).map((part) => [part.type, part.value]));

/** Milliseconds New Zealand is ahead of UTC at a given instant (+12h or +13h). */
const newZealandOffsetAt = (instant: number): number => {
  const parts = newZealandPartsOf(new Date(instant));
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - Math.floor(instant / 1000) * 1000;
};

export interface NewZealandCalendarDate {
  year: number;
  /** 1 to 12. */
  month: number;
  day: number;
}

/** The day an instant falls on in Auckland: 11pm UTC on the 11th is already the 12th there. */
export const newZealandCalendarDate = (instant: Date): NewZealandCalendarDate => {
  const parts = newZealandPartsOf(instant);
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) };
};

const dayFormatter = new Intl.DateTimeFormat('en-NZ', {
  timeZone: NEW_ZEALAND_TIME_ZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

/** "Sat 12 Dec": the Auckland day of an instant, as guests read it. */
export const formatNewZealandDay = (instant: Date): string =>
  dayFormatter.format(instant).replace(',', '');

/** "09:30": the Auckland wall-clock time of an instant, 24-hour. */
export const formatNewZealandTime = (instant: Date): string => {
  const parts = newZealandPartsOf(instant);
  return `${parts.hour}:${parts.minute}`;
};

/** The Auckland hour of an instant, 0-23. */
export const newZealandHourOf = (instant: Date): number => Number(newZealandPartsOf(instant).hour);

/** The Auckland calendar date of an instant, "2026-10-12". */
export const newZealandDateOf = (instant: Date): string => {
  const parts = newZealandPartsOf(instant);
  return `${parts.year}-${parts.month}-${parts.day}`;
};

/** "2026-10-12" + "09:00" in Auckland -> the matching instant. */
export const newZealandWallClockToDate = (isoDate: string, time: string): Date => {
  const [year = 0, month = 1, day = 1] = isoDate.split('-').map(Number);
  const [hour = 0, minute = 0] = time.split(':').map(Number);
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  // First guess with the offset at that wall-clock time, then correct once in case the guess
  // landed on the other side of a daylight-saving change.
  const firstGuess = wallClockAsUtc - newZealandOffsetAt(wallClockAsUtc);
  return new Date(wallClockAsUtc - newZealandOffsetAt(firstGuess));
};
