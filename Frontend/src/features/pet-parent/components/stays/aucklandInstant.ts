const AUCKLAND = 'Pacific/Auckland';
const MINUTE_MS = 60_000;

// Every part on a 24-hour clock, so the Auckland wall time of an instant can be read back as
// numbers whatever the browser's own time zone is.
const aucklandParts = new Intl.DateTimeFormat('en-US', {
  timeZone: AUCKLAND,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/** Minutes Auckland is ahead of UTC at `instant`: 780 in summer, 720 in winter. */
const aucklandOffsetMinutesAt = (instant: Date): number => {
  const parts = aucklandParts.formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((candidate) => candidate.type === type)?.value ?? 0);
  const wallAsUtc = Date.UTC(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour'),
    part('minute'),
    part('second'),
  );
  return Math.round((wallAsUtc - instant.getTime()) / MINUTE_MS);
};

/**
 * The instant at which Auckland's clocks read `clock` ("HH:mm") on `isoDate` ("YYYY-MM-DD"), as an
 * ISO string in UTC. The offset is read at the guessed instant and once more at the corrected one,
 * so a time near a daylight-saving change still lands on the right side of it.
 */
export const aucklandInstantOf = (isoDate: string, clock: string): string => {
  const [year, month, day] = isoDate.split('-').map(Number);
  const [hour, minute] = clock.split(':').map(Number);
  const wallAsUtc = Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, hour ?? 0, minute ?? 0);
  const firstGuess = wallAsUtc - aucklandOffsetMinutesAt(new Date(wallAsUtc)) * MINUTE_MS;
  const instant = wallAsUtc - aucklandOffsetMinutesAt(new Date(firstGuess)) * MINUTE_MS;
  return new Date(instant).toISOString();
};
