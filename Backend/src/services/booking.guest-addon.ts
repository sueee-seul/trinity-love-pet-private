import { AppError } from '../common/middlewares/error.middleware.js';
import { newZealandDateOf } from '../common/utils/new-zealand-time.js';
import {
  ADD_ON_PRICE_CHANGED,
  type AddOnCatalogue,
  type AddOnInput,
  type AddOnOffer,
  type AddOnResult,
} from '../contracts/booking.change.contract.js';
import { withLockedBooking } from '../repositories/booking.check-in.repository.js';
import { insertAddOnTask } from '../repositories/booking.in-stay.tasks.repository.js';
import {
  listServices,
  type BookingServiceRecord,
} from '../repositories/petparent.booking.repository.js';
import { assertPreviewedAmount, type ChangeDependencies } from './booking.guest-change.js';
import { bookingNotFound } from './booking.guarantee.js';
import {
  fromCents,
  nextChargeOrdinal,
  recordInStayCharge,
  settlementFor,
  stayUnderWay,
  toCents,
  type StayUnderWay,
} from './booking.in-stay.js';
import { notifyAddOnBooked } from './booking.in-stay.notifications.js';
import { scalesWithNights } from './booking.pricing.js';

/**
 * A priced extra for a day of a stay under way (Scenario 11: add-on services such as an extra
 * walk or a grooming session), booked in one tap. The offer list is the facility's add-on catalogue
 * at today's prices; the parent's tap is the request (Fair Trading Act 1986 ss 21B and 21C: nothing
 * is performed or charged without it). The saved card is charged at once, or, without one, the
 * amount is added to the bill for the desk at check-out. Staff get a care task for that day; a
 * grooming session is flagged high so staff fit it in.
 */

const MS_PER_DAY = 86_400_000;

const addDays = (isoDate: string, days: number): string =>
  new Date(Date.parse(`${isoDate}T00:00:00Z`) + days * MS_PER_DAY).toISOString().slice(0, 10);

/** Today up to the night before check-out; a pet leaving today can still have something today. */
const daysOf = (stay: StayUnderWay, now: Date): string[] => {
  const today = newZealandDateOf(now);
  const lastNight = addDays(newZealandDateOf(stay.pickUpAt), -1);
  const days: string[] = [];
  for (let day = today; day <= lastNight; day = addDays(day, 1)) days.push(day);
  return days.length > 0 ? days : [today];
};

const toOffer = (service: BookingServiceRecord): AddOnOffer => ({
  serviceId: service.id,
  name: service.name,
  description: service.description ?? null,
  price: service.price,
  priceUnit: service.priceUnit,
});

const addOnOffers = async (): Promise<BookingServiceRecord[]> =>
  (await listServices()).filter((service) => service.category === 'addon');

export const listAddOns = async (
  ownerId: string,
  bookingId: string,
  dependencies: ChangeDependencies = {},
): Promise<AddOnCatalogue> => {
  const now = dependencies.now ?? new Date();
  const catalogue = await withLockedBooking(bookingId, async (booking, client) => {
    const stay = await stayUnderWay(booking, ownerId, now, client);
    return {
      offers: (await addOnOffers()).map(toOffer),
      days: daysOf(stay, now),
      settlement: settlementFor(stay),
    };
  });
  if (!catalogue) throw bookingNotFound();
  return catalogue;
};

const notOffered = (): AppError =>
  new AppError('That add-on is not offered for this stay.', 'ADD_ON_NOT_OFFERED', 422);

export const bookAddOn = async (
  ownerId: string,
  bookingId: string,
  bookingPetId: string,
  input: AddOnInput,
  dependencies: ChangeDependencies = {},
): Promise<AddOnResult> => {
  const now = dependencies.now ?? new Date();
  const booked = await withLockedBooking(bookingId, async (booking, client) => {
    const stay = await stayUnderWay(booking, ownerId, now, client);
    const pet = stay.pets.find((candidate) => candidate.bookingPetsUuid === bookingPetId);
    if (!pet) throw bookingNotFound();
    const service = (await addOnOffers()).find((offer) => offer.id === input.serviceId);
    if (!service || !daysOf(stay, now).includes(input.date)) throw notOffered();
    // A per-stay service (grooming) happens once; the quantity only means something per day.
    const quantity = scalesWithNights(service.priceUnit) ? input.quantity : 1;
    const amount = fromCents(toCents(service.price) * quantity);
    assertPreviewedAmount(
      input.expectedAmount,
      amount,
      ADD_ON_PRICE_CHANGED,
      'The price of this add-on has changed since you saw it. Please look at the new price and confirm again.',
    );
    const ordinal = nextChargeOrdinal(
      stay.charges,
      (charge) =>
        charge.kind === 'add_on' &&
        charge.bookingPetsUuid === bookingPetId &&
        charge.servicesUuid === service.id &&
        charge.serviceDate === input.date,
    );
    const { chargeId, settlement } = await recordInStayCharge(
      stay,
      {
        kind: 'add_on',
        bookingPetsUuid: bookingPetId,
        servicesUuid: service.id,
        serviceDate: input.date,
        quantity,
        description: `${service.name} x${quantity} on ${input.date}`,
        amount,
        idempotencyKey: `addon-${bookingPetId}-${service.id}-${input.date}-${ordinal}`,
      },
      'the add-on was not booked',
      client,
      dependencies.cardProcessor,
    );
    const taskId = await insertAddOnTask(client, {
      bookingPetsUuid: bookingPetId,
      title: `${service.name} (add-on)`,
      day: input.date,
      description: `Booked by the parent on ${newZealandDateOf(now)}: ${quantity} x ${service.name}, ${settlement === 'desk' ? 'to pay at check-out' : 'paid'} $${amount.toFixed(2)}.`,
      priority: scalesWithNights(service.priceUnit) ? 'mid' : 'high',
    });
    return {
      chargeId,
      bookingPetId,
      petName: '',
      serviceName: service.name,
      date: input.date,
      quantity,
      amount,
      taskId,
      settlement,
    };
  });
  if (!booked) throw bookingNotFound();
  const result = await notifyAddOnBooked(bookingId, booked);
  return result;
};
