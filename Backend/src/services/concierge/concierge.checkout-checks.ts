import type { ConciergeCheckoutRequest } from '../../contracts/concierge.contract.js';
import { AppError } from '../../common/middlewares/error.middleware.js';
import * as bookingRepository from '../../repositories/petparent.booking.repository.js';
import {
  emailHasPasswordAccount,
  findSavedPetSpecies,
} from '../../repositories/concierge.repository.js';
import { findUserByEmail } from '../../repositories/auth.repository.js';
import { newPasswordIssues } from '../../contracts/auth.signup.contract.js';
import {
  accountExistsError,
  canBookAsPetOwner,
  passwordAccountError,
} from './concierge.identity.js';
import { readSavedSpecies } from './concierge.species.js';
import { verifyVerifiedEmail, type SignedQuote } from './concierge.tokens.js';

/**
 * The checks a concierge checkout passes before anything is written: who the guest is, and that
 * the pets and services still match the quote they agreed to.
 */

export interface CheckoutIdentity {
  /** The signed-in pet owner, if the request carried a valid session. */
  signedInOwnerId?: string | undefined;
}

export interface ResolvedOwner {
  existingOwnerId?: string;
  email?: string;
  /** A first-time guest's chosen password, stored hashed with the new account. */
  password?: string;
}

/**
 * A first-time guest's email and password, checked before anything is written: the address has no
 * account yet, and the password meets the sign-up rule. The password is never logged or returned.
 */
export const resolveNewAccount = async (
  request: ConciergeCheckoutRequest,
): Promise<ResolvedOwner> => {
  const account = request.newAccount;
  if (!account) throw new Error('resolveNewAccount needs request.newAccount');
  const issues = newPasswordIssues({
    email: account.email,
    username: '',
    password: account.password,
    confirmPassword: account.password,
    firstName: request.contact?.firstName ?? '',
    lastName: request.contact?.lastName ?? '',
  });
  const firstIssue = issues[0];
  if (firstIssue) {
    throw new AppError(firstIssue.message, 'CONCIERGE_PASSWORD_INVALID', 422, [
      { field: 'newAccount.password', code: firstIssue.code },
    ]);
  }
  await assertEmailIsNew(account.email);
  return { email: account.email, password: account.password };
};

/** A staff address is refused, and any other existing account must be signed in to. */
export const assertEmailIsNew = async (email: string): Promise<void> => {
  const existing = await findUserByEmail(email);
  if (!existing) return;
  if (!canBookAsPetOwner(existing)) {
    throw new AppError(
      'This email belongs to a staff account. Please use a personal email to book.',
      'CONCIERGE_STAFF_EMAIL',
      409,
    );
  }
  throw accountExistsError();
};

export const resolveOwner = async (
  request: ConciergeCheckoutRequest,
  identity: CheckoutIdentity,
): Promise<ResolvedOwner> => {
  if (identity.signedInOwnerId) {
    return { existingOwnerId: identity.signedInOwnerId };
  }
  if (request.newAccount) {
    return resolveNewAccount(request);
  }
  if (!request.verificationToken) {
    throw new AppError(
      'Please sign in, or choose a password to make your account, before booking.',
      'CONCIERGE_EMAIL_UNVERIFIED',
      401,
    );
  }
  const email = await verifyVerifiedEmail(request.verificationToken);
  const existing = await findUserByEmail(email);
  if (!existing) {
    return { email };
  }
  if (!canBookAsPetOwner(existing)) {
    throw new AppError(
      'This email belongs to a staff account. Please use a personal email to book.',
      'CONCIERGE_STAFF_EMAIL',
      409,
    );
  }
  if (await emailHasPasswordAccount(email)) {
    // Sign-up does not prove the address, so a password account is only joined after its own
    // password sign-in, never by an email code.
    throw passwordAccountError();
  }
  // The guest proved control of this address, so the booking joins the existing account.
  return { existingOwnerId: existing.id };
};

export const assertPetsMatchQuote = (
  request: ConciergeCheckoutRequest,
  quote: SignedQuote,
): void => {
  if (request.pets.length !== quote.pets.length) {
    throw new AppError(
      `This quote is for ${quote.pets.length} pet(s). Please describe each of them.`,
      'CONCIERGE_PET_COUNT_MISMATCH',
      422,
    );
  }
  const savedPetIds = request.pets.flatMap((pet) =>
    'existingPetId' in pet ? [pet.existingPetId] : [],
  );
  if (new Set(savedPetIds).size !== savedPetIds.length) {
    throw new AppError(
      'Each saved pet can only be chosen once per booking.',
      'CONCIERGE_PET_DUPLICATED',
      422,
    );
  }
};

/**
 * The agreed price is the price. The guest was told "Price held until …" and agreed to exactly
 * these lines, so a catalogue change after that does not reach them (an accepted quote binds the
 * business; MBIE quote guidance). The signature already proves the lines and total are the ones
 * the server priced; this only checks each service can still be booked at all.
 */
export const assertQuotedServicesStillOffered = async (quote: SignedQuote): Promise<void> => {
  const serviceIds = Array.from(new Set(quote.lines.map((line) => line.serviceId)));
  const catalogue = await bookingRepository.getServiceCatalogByIds(serviceIds);
  if (serviceIds.some((serviceId) => !catalogue.has(serviceId))) {
    throw new AppError(
      'A service in this quote is no longer offered. Please ask for a fresh quote.',
      'CONCIERGE_QUOTE_STALE',
      409,
    );
  }
};

export const assertOwnsExistingPets = async (ownerId: string, petIds: string[]): Promise<void> => {
  if (petIds.length === 0) return;
  const owned = await bookingRepository.getOwnedPetIds(ownerId, petIds);
  if (petIds.some((petId) => !owned.has(petId))) {
    throw new AppError('One or more pets are not on your account.', 'CONCIERGE_PET_NOT_OWNED', 422);
  }
};

/** The pet booked is the pet that was priced: a saved dog cannot fill a cat's quote. */
export const assertSavedPetsMatchQuote = async (
  ownerId: string,
  request: ConciergeCheckoutRequest,
  quote: SignedQuote,
): Promise<void> => {
  const saved = request.pets.flatMap((pet, index) =>
    'existingPetId' in pet ? [{ petId: pet.existingPetId, index }] : [],
  );
  if (saved.length === 0) return;
  const speciesById = await findSavedPetSpecies(
    ownerId,
    saved.map((entry) => entry.petId),
  );
  const mismatch = saved.some(({ petId, index }) => {
    const savedSpecies = readSavedSpecies(speciesById.get(petId));
    const quotedSpecies = quote.pets[index]?.species;
    return savedSpecies !== null && quotedSpecies !== 'other' && savedSpecies !== quotedSpecies;
  });
  if (mismatch) {
    throw new AppError(
      'A saved pet is not the kind of pet in this plan. Please choose another pet or change the plan.',
      'CONCIERGE_PET_SPECIES_MISMATCH',
      422,
    );
  }
};
