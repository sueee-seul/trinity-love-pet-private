import type { ConciergeNeeds } from '../../contracts/concierge.contract.js';
import type { BookingServiceRecord } from '../../repositories/petparent.booking.repository.js';
import { verifyAcceptedQuote } from '../../services/concierge/concierge.tokens.js';

/** A small but complete catalogue: three rooms, two foods, and one add-on of each kind. */
export const CATALOGUE: BookingServiceRecord[] = [
  {
    id: '11111111-1111-4111-8111-000000000001',
    name: 'Cosy room',
    category: 'boarding_rate',
    price: 45,
    priceUnit: 'per night',
    compulsory: false,
  },
  {
    id: '11111111-1111-4111-8111-000000000002',
    name: 'Garden suite',
    category: 'boarding_rate',
    price: 60,
    priceUnit: 'per night',
    compulsory: false,
  },
  {
    id: '11111111-1111-4111-8111-000000000003',
    name: 'Royal suite',
    category: 'boarding_rate',
    price: 85,
    priceUnit: 'per night',
    compulsory: false,
  },
  {
    id: '11111111-1111-4111-8111-000000000004',
    name: 'House food',
    category: 'food',
    price: 0,
    priceUnit: 'per stay',
    compulsory: false,
  },
  {
    id: '11111111-1111-4111-8111-000000000005',
    name: 'Premium food',
    category: 'food',
    price: 8,
    priceUnit: 'per day',
    compulsory: false,
  },
  {
    id: '11111111-1111-4111-8111-000000000006',
    name: 'Daily walk',
    category: 'addon',
    price: 15,
    priceUnit: 'per day',
    compulsory: false,
  },
  {
    id: '11111111-1111-4111-8111-000000000007',
    name: 'Farewell bath',
    category: 'addon',
    price: 35,
    priceUnit: 'per stay',
    compulsory: false,
  },
  {
    id: '11111111-1111-4111-8111-000000000008',
    name: 'Medication administration',
    category: 'addon',
    price: 5,
    priceUnit: 'per day',
    compulsory: false,
  },
  {
    id: '11111111-1111-4111-8111-000000000009',
    name: 'Group playtime',
    category: 'addon',
    price: 10,
    priceUnit: 'per day',
    compulsory: false,
  },
];

export const TODAY = '2026-10-01';

export const readyNeeds = (overrides: Partial<ConciergeNeeds> = {}): ConciergeNeeds => ({
  service: 'boarding',
  startDate: '2026-10-12',
  endDate: '2026-10-15',
  pets: [{ species: 'dog', size: 'large', needsMedication: false, firstTimeBoarding: true }],
  extras: { walks: false, grooming: false, playtime: false },
  notes: '',
  ...overrides,
});

export const TEST_SIGNING_SECRET = 'test-concierge-signing-secret-at-least-32-bytes';

/** The card setup the development fake confirms for an accepted quote (fake_seti_<acceptance>). */
export const fakeCardSetupFor = async (acceptedQuoteToken: string): Promise<string> =>
  `fake_seti_${(await verifyAcceptedQuote(acceptedQuoteToken)).acceptanceId}`;
