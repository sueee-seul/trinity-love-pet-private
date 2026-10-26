import {
  CONCIERGE_CURRENCY,
  CONCIERGE_SAFETY_TASKS,
  type ConciergeCheckoutRequest,
  type ConciergeCheckoutResponse,
} from '../../contracts/concierge.contract.js';
import { AppError } from '../../common/middlewares/error.middleware.js';
import { newZealandWallClockToDate } from '../../common/utils/new-zealand-time.js';
import {
  currentAgreementTerms,
  agreementName,
} from '../../repositories/booking.agreement.repository.js';
import * as bookingRepository from '../../repositories/petparent.booking.repository.js';
import {
  ConciergeEmailTakenError,
  createOwnerAndPets,
  findBookingPetIds,
  removeCreatedOwnerAndPets,
  type ConciergeOwnerAndPetsResult,
  type NewConciergePet,
} from '../../repositories/concierge.repository.js';
import {
  assertRoomForStay,
  findFullNights,
  fullyBookedError,
  type StayForCapacity,
} from '../booking.capacity.js';
import { reviewDeadlineFor } from '../booking.fee-policy.js';
import { notifyBookingPlaced } from '../booking.notifications.js';
import { fillPetProfilesFromBooking } from './concierge.pet-profile.js';
import { toConfirmationNumber } from '../petparent.booking.js';
import { conciergeAcceptances, type AcceptanceRegistry } from './concierge.acceptance-registry.js';
import { toBookingPets } from './concierge.checkout-pets.js';
import {
  decidePetReviews,
  overallStatus,
  type PetReviewDecision,
} from './concierge.checkout-review.js';
import {
  assertOwnsExistingPets,
  assertPetsMatchQuote,
  assertQuotedServicesStillOffered,
  assertSavedPetsMatchQuote,
  resolveOwner,
  type CheckoutIdentity,
  type ResolvedOwner,
} from './concierge.checkout-checks.js';
import { verifyAcceptedQuote, type SignedQuote } from './concierge.tokens.js';

export type { CheckoutIdentity } from './concierge.checkout-checks.js';

/**
 * Turns an accepted quote into a booking request. Nothing is paid or held online (owner decision
 * 2026-10-14): every pet waits for our manager, who approves or refuses it, and the guest pays at
 * the desk after the arrival health check.
 *
 * The guest is identified either by their session (already signed in) or by a verified-email
 * token; an account is created only for a verified email that has none. The request is recorded
 * at the prices the guest agreed to; checkout stops if a quoted service is no longer offered or a
 * night of the stay is full. A waiting stay is never called booked (Fair Trading Act 1986 s9,
 * s11). Capacity is checked before anything is created and again inside the booking transaction
 * under a lock, so two guests cannot both ask for the last place.
 *
 * Each acceptance books once: a repeat submission is refused with the reference of the request it
 * already made (and never signs anyone in). If writing the request fails after an account or pets
 * were created for it, they are removed again, so a retry starts clean.
 */

export interface CheckoutDependencies {
  acceptances?: AcceptanceRegistry;
  now?: () => Date;
}

interface BookingContext {
  acceptanceId: string;
  now: Date;
}

const stayOf = (quote: SignedQuote): StayForCapacity => ({
  startDate: quote.startDate,
  endDate: quote.endDate,
  petCount: quote.pets.length,
});

const alreadySubmitted = (confirmationNumber: string): AppError =>
  new AppError(
    `This request was already sent (reference ${confirmationNumber}).`,
    'CONCIERGE_ALREADY_SUBMITTED',
    409,
    [{ confirmationNumber }],
  );

const logCleanupFailure =
  (step: string) =>
  (cleanupError: unknown): void => {
    console.error(`Concierge checkout cleanup failed: ${step}`, {
      name: cleanupError instanceof Error ? cleanupError.name : 'unknown',
    });
  };

const createAccountAndPets = async (
  request: ConciergeCheckoutRequest,
  owner: ResolvedOwner,
  newPets: NewConciergePet[],
): Promise<ConciergeOwnerAndPetsResult> => {
  try {
    return await createOwnerAndPets({
      existingOwnerId: owner.existingOwnerId,
      newOwner:
        owner.existingOwnerId || !request.contact || !owner.email
          ? undefined
          : { email: owner.email, password: owner.password, ...request.contact },
      pets: newPets,
    });
  } catch (error: unknown) {
    if (error instanceof ConciergeEmailTakenError) {
      throw new AppError(
        'An account was just created for this email. Please verify again to continue.',
        'CONCIERGE_EMAIL_TAKEN',
        409,
      );
    }
    throw error;
  }
};

/** Each quoted pet position's pet id: saved pets in place, new pets in creation order. */
const petIdsInQuoteOrder = (
  request: ConciergeCheckoutRequest,
  created: ConciergeOwnerAndPetsResult,
): string[] => {
  const newPetIds = [...created.petIds];
  return request.pets.map((pet) => {
    const petId = 'existingPetId' in pet ? pet.existingPetId : newPetIds.shift();
    if (!petId) {
      throw new Error('A new pet was not created for every quoted pet');
    }
    return petId;
  });
};

export const checkoutConciergeBooking = async (
  request: ConciergeCheckoutRequest,
  identity: CheckoutIdentity,
  dependencies: CheckoutDependencies = {},
): Promise<ConciergeCheckoutResponse & { ownerId: string }> => {
  const acceptances = dependencies.acceptances ?? conciergeAcceptances;
  const { quote, acceptanceId } = await verifyAcceptedQuote(request.acceptedQuoteToken);
  assertPetsMatchQuote(request, quote);

  const claim = acceptances.claim(acceptanceId);
  if (claim.outcome === 'completed') {
    throw alreadySubmitted(claim.checkout.confirmationNumber);
  }
  if (claim.outcome === 'in_progress') {
    throw new AppError(
      'This request is already being sent. Please wait a moment.',
      'CONCIERGE_SUBMISSION_IN_PROGRESS',
      409,
    );
  }

  try {
    const result = await bookAcceptedQuote(request, identity, quote, {
      acceptanceId,
      now: (dependencies.now ?? ((): Date => new Date()))(),
    });
    acceptances.complete(acceptanceId, { confirmationNumber: result.confirmationNumber });
    return result;
  } catch (error: unknown) {
    acceptances.release(acceptanceId);
    throw error;
  }
};

const bookAcceptedQuote = async (
  request: ConciergeCheckoutRequest,
  identity: CheckoutIdentity,
  quote: SignedQuote,
  context: BookingContext,
): Promise<ConciergeCheckoutResponse & { ownerId: string }> => {
  const owner = await resolveOwner(request, identity);
  if (!owner.existingOwnerId && !request.contact) {
    throw new AppError(
      'Please add your contact details so we can create your account.',
      'CONCIERGE_CONTACT_REQUIRED',
      422,
    );
  }

  await assertQuotedServicesStillOffered(quote);
  const termsVersionsUuid = await currentAgreementTerms(request.agreement.termsVersionLabel);

  const existingPetIds = request.pets.flatMap((pet) =>
    'existingPetId' in pet ? [pet.existingPetId] : [],
  );
  if (owner.existingOwnerId) {
    await assertOwnsExistingPets(owner.existingOwnerId, existingPetIds);
    await assertSavedPetsMatchQuote(owner.existingOwnerId, request, quote);
  } else if (existingPetIds.length > 0) {
    throw new AppError('A new account has no saved pets yet.', 'CONCIERGE_PET_NOT_OWNED', 422);
  }

  // Checked early so a full night never creates an account, and again under the lock below.
  const fullNights = await findFullNights(stayOf(quote));
  if (fullNights.length > 0) throw fullyBookedError(fullNights);

  const requested = await recordBooking(request, quote, context, { owner, termsVersionsUuid });
  const dropOffAt = newZealandWallClockToDate(quote.startDate, request.stay.dropOffTime);
  return {
    ...requested,
    payment: {
      status: 'pay_at_desk',
      amount: quote.total,
      reviewBy: reviewDeadlineFor({ bookedAt: context.now, dropOffAt }).toISOString(),
    },
  };
};

interface BookingRecordInput {
  owner: ResolvedOwner;
  termsVersionsUuid: string;
}

/** Creates the account and pets if needed, then writes the request in one transaction. */
const recordBooking = async (
  request: ConciergeCheckoutRequest,
  quote: SignedQuote,
  context: BookingContext,
  input: BookingRecordInput,
): Promise<Omit<ConciergeCheckoutResponse, 'payment'> & { ownerId: string }> => {
  // Species comes from the quote, not from checkout, so the pet booked is the pet that was priced.
  const newPets: NewConciergePet[] = request.pets.flatMap((pet, index) => {
    const quotedSpecies = quote.pets[index]?.species;
    return 'newPet' in pet && quotedSpecies ? [{ ...pet.newPet, species: quotedSpecies }] : [];
  });

  const created = await createAccountAndPets(request, input.owner, newPets);
  const petIdByIndex = petIdsInQuoteOrder(request, created);

  let booking: bookingRepository.CreatedBookingRecord;
  let decisions: PetReviewDecision[];
  try {
    decisions = await decidePetReviews(quote, petIdByIndex);
    booking = await bookingRepository.createBooking({
      petOwnersUuid: created.ownerId,
      pets: toBookingPets(request, quote, petIdByIndex, decisions),
      agreement: {
        termsVersionsUuid: input.termsVersionsUuid,
        fullName: await agreementName(created.ownerId),
        // Click-to-agree under the server-owned account name; there is no second signature.
        signatureUrl: null,
        // The parent agrees to the booking terms on the details step, in the request that
        // reaches here. Choosing the package earlier only accepted its price, so the agreement
        // carries the time the request was sent.
        agreedAt: context.now,
      },
      // No payment row: nothing is paid online. Each pet carries its own review.
      recording: { bookingStatus: 'confirmed', petReviewStatus: 'pending' },
      beforeWrite: async (client) => {
        const currentId = await currentAgreementTerms(request.agreement.termsVersionLabel, client);
        if (currentId !== input.termsVersionsUuid) {
          throw new AppError(
            'The booking terms changed. Refresh and agree again.',
            'TERMS_VERSION_CHANGED',
            409,
          );
        }
        await assertRoomForStay(client, stayOf(quote));
      },
    });
  } catch (error: unknown) {
    // Undo what this attempt created, so a retry does not leave an empty account or duplicate
    // pets behind. The original failure is what the guest needs to hear about.
    await removeCreatedOwnerAndPets(created).catch(logCleanupFailure('remove account and pets'));
    throw error;
  }

  // Read back so the confirmation can link each pet's safety tasks; a failed read only costs the
  // direct links (the tasks are still listed), never the booking that was just made.
  let bookingPetIds: string[] = [];
  try {
    bookingPetIds = await findBookingPetIds(booking.bookingId, petIdByIndex);
  } catch (readError: unknown) {
    console.error('Concierge booking pet read-back failed', {
      name: readError instanceof Error ? readError.name : 'unknown',
    });
  }

  // The parent's receipt (the request waits for our manager) and the managers' notice. Care tasks
  // come when a manager approves. It logs its own failures, so the booking that was just saved
  // is never lost to a notice.
  await notifyBookingPlaced(
    booking.bookingId,
    decisions.map((decision) => ({ name: decision.petName, reasons: decision.reasons })),
  );

  // Each new pet's profile card is filled from what the guest told us, in the background: the
  // booking is already saved, and a slow or failed read only leaves the card for the parent.
  void fillPetProfilesFromBooking(
    created.ownerId,
    newPets.flatMap((pet, index) => {
      const petId = created.petIds[index];
      return petId ? [{ petId, name: pet.name, species: pet.species }] : [];
    }),
    request.careNotes ?? '',
  );

  return {
    ownerId: created.ownerId,
    bookingId: booking.bookingId,
    bookingPetIds,
    confirmationNumber: toConfirmationNumber(booking.bookingId),
    status: overallStatus(decisions),
    pets: decisions.map((decision) => ({
      name: decision.petName,
      status: decision.reviewStatus === 'approved' ? 'confirmed' : 'waiting_for_review',
      reviewReasons: decision.reasons,
    })),
    total: quote.total,
    currency: CONCIERGE_CURRENCY,
    accountCreated: created.accountCreated,
    safetyTasks: [...CONCIERGE_SAFETY_TASKS],
  };
};
