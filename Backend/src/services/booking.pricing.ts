/**
 * The one pricing rule for a boarding stay, shared by every path that turns services into money.
 *
 * The concierge prices every package with it, and its checkout records the signed quote's total,
 * so the price the owner agreed to and the total recorded can never drift apart.
 */

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Services priced per night or per day are multiplied by the stay length; the rest are flat. */
const NIGHTLY_PRICE_UNITS = new Set(['per night', 'per day']);

export interface PricedService {
  price: number;
  priceUnit: string;
}

/** Nights between two ISO dates; a same-day stay still counts as one night. */
export const nightsBetween = (startDate: string, endDate: string): number => {
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const end = new Date(`${endDate}T00:00:00Z`).getTime();
  const diffDays = Math.round((end - start) / MS_PER_DAY);
  return Math.max(diffDays, 1);
};

export const scalesWithNights = (priceUnit: string): boolean => NIGHTLY_PRICE_UNITS.has(priceUnit);

export const lineTotal = (service: PricedService, nights: number, quantity: number): number => {
  const multiplier = scalesWithNights(service.priceUnit) ? nights : 1;
  return service.price * multiplier * quantity;
};

/** Rounds to cents so a sum of lines never shows floating-point dust such as 129.99999999. */
export const roundToCents = (amount: number): number => Math.round(amount * 100) / 100;
