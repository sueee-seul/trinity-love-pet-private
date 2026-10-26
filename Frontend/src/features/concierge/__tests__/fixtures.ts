import { useAuthStore } from '../../../shared/auth/store/authStore';
import { createEmptyNeeds, useConciergeStore } from '../store/conciergeStore';
import type {
  ConciergeAcceptQuoteResponse,
  ConciergeBookingPolicy,
  ConciergeCatalogue,
  ConciergeCatalogueItem,
  ConciergeCheckoutResponse,
  ConciergeCombo,
  ConciergeLastStay,
  ConciergeNeeds,
  ConciergePetSelection,
  ConciergeQuote,
  ConciergeQuoteLine,
  ConciergeStatusResponse,
} from '../types';

/** Every fixture quote is for a three-night stay. */
const NIGHTS = 3;

/** The owner's fee rules as the server states them (Backend booking.fee-policy.ts). */
export const BOOKING_POLICY: ConciergeBookingPolicy = {
  freeCancellationHours: 168,
  shortNoticeHours: 72,
  shortNoticeFeePercent: 50,
  reviewWindowHours: 24,
  lateFeeBasis: 'first_night',
};

/** The pet parent most page tests sign in as: Ava, whose account name signs the terms. */
export const AVA = {
  email: 'ava@example.test',
  name: 'Ava Mitchell',
  is_employee: false,
  is_pet_owner: true,
} as const;

/** Ava is signed in, as the app shell leaves the auth store after its session check. */
export const signInParent = (): void => {
  useAuthStore.getState().login({ ...AVA });
};

/** A status answer: the team is reachable, and cards go to the development fake. */
export const statusResponse = (
  overrides: Partial<ConciergeStatusResponse> = {},
): ConciergeStatusResponse => ({
  emailCodes: true,
  contact: { email: 'bookings@wagstay.example', phone: '09 555 0100' },
  cardPayments: { processor: 'fake', testMode: true },
  capacityConfigured: true,
  policy: BOOKING_POLICY,
  assistantMode: 'claude',
  aiProcessing: {
    assistant: { kind: 'bedrock', region: 'ap-southeast-2' },
    speech: { kind: 'whisper', region: null },
    parentChat: { kind: 'bedrock', region: 'ap-southeast-2' },
  },
  ...overrides,
});

/** A request waiting for our manager; nothing is paid online. */
export const checkoutResponse = (
  overrides: Partial<ConciergeCheckoutResponse> = {},
): ConciergeCheckoutResponse => ({
  bookingId: 'booking-1',
  bookingPetIds: ['booking-pet-1'],
  confirmationNumber: 'PB-AAAAAA',
  status: 'awaiting_manager_approval',
  pets: [{ name: 'Biscuit', status: 'waiting_for_review', reviewReasons: ['medication'] }],
  total: 230,
  currency: 'NZD',
  accountCreated: true,
  safetyTasks: ['vaccination_certificate'],
  // The stay waits for our manager; nothing is paid online, $230 is paid at the desk.
  payment: { status: 'pay_at_desk', amount: 230, reviewBy: '2026-12-02T02:00:00.000Z' },
  ...overrides,
});

const item = (
  id: string,
  name: string,
  category: ConciergeCatalogueItem['category'],
  unitPrice: number,
  priceUnit: string,
  flags: Partial<Pick<ConciergeCatalogueItem, 'compulsory' | 'dogOnly' | 'description'>> = {},
): ConciergeCatalogueItem => ({
  id,
  name,
  category,
  description: null,
  unitPrice,
  priceUnit,
  compulsory: false,
  dogOnly: false,
  ...flags,
});

/** Two rooms, two foods and three add-ons, cheapest first, as the server lists them. */
export const catalogue: ConciergeCatalogue = {
  rooms: [
    item('room-standard', 'Standard room', 'boarding_rate', 52, 'per night'),
    item('room-deluxe', 'Deluxe suite', 'boarding_rate', 68, 'per night', {
      description: 'A larger room with a window.',
    }),
  ],
  foods: [
    item('food-house', 'House food', 'food', 6, 'per day'),
    item('food-fresh', 'Fresh food menu', 'food', 14, 'per day'),
  ],
  addons: [
    item('addon-medication', 'Medication administration', 'addon', 6, 'per day'),
    item('addon-walk', 'Outdoor walk', 'addon', 15, 'per day', { dogOnly: true }),
    item('addon-grooming', 'Grooming: bath and brush', 'addon', 55, 'per stay'),
  ],
};

const allItems = [...catalogue.rooms, ...catalogue.foods, ...catalogue.addons];

const lineFor = (id: string, petIndex: number): ConciergeQuoteLine => {
  const service = allItems.find((candidate) => candidate.id === id);
  if (!service) throw new Error(`No fixture service ${id}`);
  return {
    serviceId: service.id,
    name: service.name,
    category: service.category,
    petIndex,
    quantity: 1,
    unitPrice: service.unitPrice,
    priceUnit: service.priceUnit,
    lineTotal: service.priceUnit === 'per stay' ? service.unitPrice : service.unitPrice * NIGHTS,
  };
};

/** A signed quote for these choices, priced the way the server prices them (3 nights). */
export const quoteFor = (pets: ConciergePetSelection[], token: string): ConciergeQuote => {
  const lines = pets.flatMap((pet, petIndex) =>
    [pet.roomId, pet.foodId, ...pet.addonIds].map((id) => lineFor(id, petIndex)),
  );
  const names = lines.filter((line) => line.petIndex === 0).map((line) => line.name);
  return {
    name:
      names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names.join(''),
    selection: { pets },
    nights: NIGHTS,
    lines,
    total: Math.round(lines.reduce((sum, line) => sum + line.lineTotal, 0) * 100) / 100,
    currency: 'NZD',
    gstInclusive: true,
    quoteToken: token,
    expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
  };
};

/** Standard room and house food: $174.00. */
export const simpleCombo: ConciergeCombo = {
  id: 'combo-simple',
  quote: quoteFor(
    [{ roomId: 'room-standard', foodId: 'food-house', addonIds: [] }],
    'quote-simple',
  ),
  reason: 'Everything you asked for and nothing more: the room, meals and daily care.',
  recommended: false,
};

/** Deluxe suite, house food and a daily walk: $267.00, the server's pick. */
export const roomierCombo: ConciergeCombo = {
  id: 'combo-roomier',
  quote: quoteFor(
    [{ roomId: 'room-deluxe', foodId: 'food-house', addonIds: ['addon-walk'] }],
    'quote-roomier',
  ),
  reason: 'A roomier suite with a daily walk, which suits a large dog.',
  recommended: true,
};

export const combos: ConciergeCombo[] = [simpleCombo, roomierCombo];

/**
 * Max's stay in September, copied for "same as last time": the pet and the services, never the
 * dates. The services are the recommended combo's unless a test says otherwise.
 */
export const lastStayFor = (
  pets: ConciergePetSelection[] = roomierCombo.quote.selection.pets,
  savedPetIds: (string | null)[] = ['pet-max'],
): ConciergeLastStay => ({
  confirmationNumber: 'PB-AAAAAA',
  startDate: '2026-09-10',
  endDate: '2026-09-13',
  needs: {
    ...createEmptyNeeds(),
    pets: pets.map((_, index) => ({
      name: index === 0 ? 'Max' : `Pet ${index + 1}`,
      species: 'dog',
      size: null,
      needsMedication: false,
      firstTimeBoarding: false,
    })),
  },
  selection: { pets },
  savedPetIds,
});

export const acceptedFor = (quote: ConciergeQuote): ConciergeAcceptQuoteResponse => ({
  acceptedQuoteToken: 'accepted-token-long-enough',
  acceptedAt: new Date().toISOString(),
  name: quote.name,
  total: quote.total,
});

/** One large dog from Sat 12 Dec to Tue 15 Dec 2026. */
export const oneDog: ConciergeNeeds = {
  ...createEmptyNeeds(),
  startDate: '2026-12-12',
  endDate: '2026-12-15',
  pets: [{ species: 'dog', size: 'large', needsMedication: false, firstTimeBoarding: null }],
};

/** Ava, signed in, on the details step with every field filled and the booking terms agreed. */
export const openFilledDetails = (): void => {
  signInParent();
  useConciergeStore.setState({
    needs: oneDog,
    // One position per pet, as the store links them once the account's pets have loaded; a draft
    // built for different links would be rebuilt, and the typed pet name with it.
    savedPetLinks: [null],
    missingFields: [],
    accepted: {
      acceptedQuoteToken: 'accepted-token-long-enough',
      acceptedAt: new Date().toISOString(),
      name: roomierCombo.quote.name,
      total: roomierCombo.quote.total,
    },
    agreedQuote: roomierCombo.quote,
  });
  const store = useConciergeStore.getState();
  store.setVerified(AVA.email, null);
  store.goTo('details');
  store.initDetailsDraft();
  store.updateDetailsDraft((draft) => ({
    ...draft,
    pets: draft.pets.map((pet) => ({ ...pet, name: 'Biscuit' })),
    dropOffTime: '10:00',
    pickUpTime: '16:00',
    termsAccepted: true,
    vetConsent: true,
  }));
};
