import { AppError } from '../common/middlewares/error.middleware.js';
import {
  countPetsPerNight,
  lockBookingCapacity,
  readFacilityCapacity,
  type SqlRunner,
} from '../repositories/booking.capacity.repository.js';

/**
 * Whether a stay fits, night by night. Booking is instant, so this check is what stops Wagstay
 * from taking more pets than it has room for: it runs when options are priced (so a guest hears
 * early) and again inside the booking transaction under a lock (so two guests cannot both take
 * the last place).
 */

export interface StayForCapacity {
  /** Drop-off date, YYYY-MM-DD in New Zealand. */
  startDate: string;
  /** Pick-up date, YYYY-MM-DD in New Zealand; always after startDate for a bookable stay. */
  endDate: string;
  petCount: number;
  /** A booking moving to these dates: its own pets are not counted against it. */
  excludeBookingId?: string;
}

const MS_PER_DAY = 86_400_000;

/** The nights a stay occupies: the drop-off date up to the night before pick-up. */
export const nightsOfStay = (startDate: string, endDate: string): string[] => {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  const nights: string[] = [];
  for (let night = start; night < end; night += MS_PER_DAY) {
    nights.push(new Date(night).toISOString().slice(0, 10));
  }
  return nights;
};

const capacityNotSetUp = (): AppError =>
  new AppError(
    'Online booking is not set up yet. Please contact our team.',
    'CONCIERGE_NOT_CONFIGURED',
    503,
  );

/** The nights, in order, that cannot take this many more pets. Empty when the stay fits. */
export const findFullNights = async (
  stay: StayForCapacity,
  runner?: SqlRunner,
): Promise<string[]> => {
  const nights = nightsOfStay(stay.startDate, stay.endDate);
  const [firstNight] = nights;
  const lastNight = nights[nights.length - 1];
  if (!firstNight || !lastNight) return [];

  const capacity = await readFacilityCapacity(runner);
  if (capacity === null) throw capacityNotSetUp();

  const occupancy = await countPetsPerNight(
    firstNight,
    lastNight,
    runner,
    stay.excludeBookingId ?? null,
  );
  return occupancy
    .filter((night) => night.booked + stay.petCount > capacity)
    .map((night) => night.night);
};

/** CONCIERGE_FULLY_BOOKED (409), carrying each full night so the page can name them. */
export const fullyBookedError = (fullNights: string[]): AppError =>
  new AppError(
    'Some of those nights are fully booked.',
    'CONCIERGE_FULLY_BOOKED',
    409,
    fullNights.map((night) => ({ night })),
  );

/**
 * Throws CONCIERGE_FULLY_BOOKED when the stay does not fit. Call it with the booking transaction's
 * client, before anything is written.
 */
export const assertRoomForStay = async (
  client: SqlRunner,
  stay: StayForCapacity,
): Promise<void> => {
  await lockBookingCapacity(client);
  const fullNights = await findFullNights(stay, client);
  if (fullNights.length > 0) throw fullyBookedError(fullNights);
};
