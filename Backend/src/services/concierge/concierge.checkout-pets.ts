import type { ConciergeCheckoutRequest } from '../../contracts/concierge.contract.js';
import { OWNER_SAID_NEEDS_MEDICATION_NOTE } from '../../common/utils/booking-care-notes.js';
import { newZealandWallClockToDate } from '../../common/utils/new-zealand-time.js';
import type * as bookingRepository from '../../repositories/petparent.booking.repository.js';
import type { PetReviewDecision } from './concierge.checkout-review.js';
import type { SignedQuote } from './concierge.tokens.js';

/** The booking pets a checkout writes: dates, quoted lines and the care notes staff read. */

/** Care details the concierge gathered, in the fields staff already read. */
const careInfoFor = (
  quoted: SignedQuote['pets'][number] | undefined,
  careNotes: string | undefined,
): { medInstruction: string; others: string } => ({
  medInstruction: quoted?.needsMedication ? OWNER_SAID_NEEDS_MEDICATION_NOTE : '',
  others: [
    quoted?.size ? `Size (told to the booking assistant): ${quoted.size}` : '',
    careNotes ?? '',
  ]
    .filter(Boolean)
    .join('\n'),
});

export const toBookingPets = (
  request: ConciergeCheckoutRequest,
  quote: SignedQuote,
  petIdByIndex: string[],
  decisions: PetReviewDecision[],
): bookingRepository.CreateBookingPetInput[] =>
  petIdByIndex.map((petId, index) => ({
    petId,
    reviewStatus: decisions[index]?.reviewStatus ?? 'pending',
    dropOffAt: newZealandWallClockToDate(quote.startDate, request.stay.dropOffTime),
    pickUpAt: newZealandWallClockToDate(quote.endDate, request.stay.pickUpTime),
    services: quote.lines
      .filter((line) => line.petIndex === index)
      .map((line) => ({
        serviceId: line.serviceId,
        quantity: line.quantity,
        priceAtBooking: line.unitPrice,
      })),
    // Vaccination proof is checked at drop-off; vet consent is part of the recorded agreement;
    // unknown answers stay null rather than being guessed.
    info: {
      feedingRoutine: '',
      firstTimeBoarding: quote.pets[index]?.firstTimeBoarding ?? null,
      crateTrained: null,
      socialAllow: null,
      fullyVaccinated: null,
      behaveNHealth: '',
      ...careInfoFor(quote.pets[index], request.careNotes),
    },
  }));
