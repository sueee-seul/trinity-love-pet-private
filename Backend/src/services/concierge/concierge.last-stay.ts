import type {
  ConciergeLastStay,
  ConciergePetNeed,
  ConciergePetSelection,
  ConciergeSpecies,
} from '../../contracts/concierge.contract.js';
import type { BookingServiceRecord } from '../../repositories/petparent.booking.repository.js';
import {
  listBookingsForOwner,
  type MyBookingPetRow,
} from '../../repositories/petparent.booking.read.repository.js';
import { getServiceCatalog, toConfirmationNumber } from '../petparent.booking.js';
import { todayInNewZealand } from './concierge.needs.js';
import {
  extrasFromServiceNames,
  isMedicationHandling,
  toCatalogueView,
} from './concierge.quotes.js';

/**
 * "Same as last time" for a signed-in parent: the pets and the services of their latest booking,
 * ready to drop into the stay panel. Dates are never copied, because a repeat stay is always on
 * new dates, and the guest still checks, agrees and sends the booking themselves.
 *
 * Only what the parent already owns is read (their own bookings), through the same query as "My
 * stays". A service the facility has since retired is left out; a retired room or food falls back
 * to the cheapest one still offered, so the copied stay can always be priced.
 */

/** The guest asks for a repeat of their last stay, in either language. */
const SAME_AS_LAST_TIME =
  /\b(?:(?:the )?same as (?:my |the )?last (?:time|stay|booking|visit)|like last time|same (?:stay|booking) as (?:last time|before)|repeat (?:my |the )?last (?:stay|booking))\b|和上次一样|跟上次一样|和上次相同|和以前一样|跟以前一样|和之前一样|跟之前一样|照上次|按上次|上次那样/i;

export const wantsLastStay = (text: string): boolean => SAME_AS_LAST_TIME.test(text);

export interface LastStayDependencies {
  listBookings?: (ownerId: string) => Promise<MyBookingPetRow[]>;
  loadCatalogue?: () => Promise<BookingServiceRecord[]>;
}

const toSpecies = (value: string | null): ConciergeSpecies => {
  const lower = value?.trim().toLowerCase();
  if (lower === 'dog' || lower === 'cat') return lower;
  return 'other';
};

const latestBookingRows = (rows: MyBookingPetRow[]): MyBookingPetRow[] => {
  const dated = rows.filter((row) => row.dropOffTime && row.pickUpTime);
  const latest = dated.reduce<MyBookingPetRow | null>(
    (best, row) => (best === null || row.createdAt > best.createdAt ? row : best),
    null,
  );
  return latest ? dated.filter((row) => row.bookingId === latest.bookingId) : [];
};

const toPetNeed = (row: MyBookingPetRow): ConciergePetNeed => ({
  name: row.petName,
  species: toSpecies(row.petSpecies),
  size: null,
  needsMedication: row.services.some((service) => isMedicationHandling(service.name)),
  // A pet that has stayed before is, by definition, not on its first stay.
  firstTimeBoarding: false,
});

const toPetSelection = (
  row: MyBookingPetRow,
  catalogue: BookingServiceRecord[],
): ConciergePetSelection => {
  const view = toCatalogueView(catalogue);
  const stillOffered = (category: BookingServiceRecord['category']): string[] =>
    row.services
      .filter((service) => service.category === category)
      .map((service) => service.id)
      .filter((id) => catalogue.some((service) => service.id === id));
  const [room] = stillOffered('boarding_rate');
  const [food] = stillOffered('food');
  return {
    // `toCatalogueView` refuses a catalogue without rooms or food, so the fallbacks exist.
    roomId: room ?? view.rooms[0]?.id ?? '',
    foodId: food ?? view.foods[0]?.id ?? '',
    addonIds: stillOffered('addon'),
  };
};

/** The latest stay of the owner, or null when they have none with dates. */
export const readLastStay = async (
  ownerId: string,
  dependencies: LastStayDependencies = {},
): Promise<ConciergeLastStay | null> => {
  const rows = latestBookingRows(
    await (dependencies.listBookings ?? listBookingsForOwner)(ownerId),
  );
  const [first] = rows;
  if (!first?.dropOffTime || !first.pickUpTime) return null;
  const catalogue = await (dependencies.loadCatalogue ?? getServiceCatalog)();
  const addonNames = rows.flatMap((row) =>
    row.services.filter((service) => service.category === 'addon').map((service) => service.name),
  );
  return {
    confirmationNumber: toConfirmationNumber(first.bookingId),
    startDate: todayInNewZealand(first.dropOffTime),
    endDate: todayInNewZealand(first.pickUpTime),
    needs: {
      service: 'boarding',
      startDate: null,
      endDate: null,
      pets: rows.map(toPetNeed),
      extras: extrasFromServiceNames(addonNames),
      notes: '',
    },
    selection: { pets: rows.map((row) => toPetSelection(row, catalogue)) },
    savedPetIds: rows.map((row) => row.petId),
  };
};
