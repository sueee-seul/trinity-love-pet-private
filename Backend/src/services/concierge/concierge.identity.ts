import { AppError } from '../../common/middlewares/error.middleware.js';
import { findUserByEmail, type DatabaseAuthUser } from '../../repositories/auth.repository.js';
import { emailHasPasswordAccount } from '../../repositories/concierge.repository.js';
import { createConciergeEmailSender } from './concierge.email.js';
import { readConciergeSigningSecret, signVerifiedEmail } from './concierge.tokens.js';
import { ConciergeVerificationStore } from './concierge.verification.js';

/**
 * Who a guest is, decided from an email they have proven they control.
 *
 * - A pet-owner account with that email: the proof is a sign-in (the booking joins that account,
 *   and a returning guest can come back without a password).
 * - No account: a short-lived verified-email token lets checkout create one.
 * - A staff account: refused, because one sign-in is one side of the product.
 *
 * The controller only turns the result into a cookie or a response body.
 */

export type ConciergeIdentity =
  { kind: 'existing_owner'; ownerId: string } | { kind: 'new_email'; verificationToken: string };

export interface ConciergeIdentityDependencies {
  store?: ConciergeVerificationStore;
  findUser?: (email: string) => Promise<DatabaseAuthUser | null>;
  hasPassword?: (email: string) => Promise<boolean>;
}

/** Only pet-owner accounts that are not also staff may book (matches requirePetParent). */
export const canBookAsPetOwner = (
  user: Pick<DatabaseAuthUser, 'is_pet_owner' | 'is_employee'>,
): boolean => user.is_pet_owner === true && user.is_employee !== true;

/**
 * Normal sign-up never proves the email address, so someone could register a stranger's email
 * with their own password. An email code therefore never signs into (or books onto) an account
 * that has a password; its owner signs in with the password. Accounts the concierge created, and
 * Google sign-ins, have none and keep code sign-in.
 */
/**
 * A first-time guest typed an email that already has an account. Only that account's own sign-in
 * may book on it, so a booking can never join or take over somebody else's account.
 */
export const accountExistsError = (): AppError =>
  new AppError(
    'This email already has a Wagstay account. Please sign in to book with it.',
    'CONCIERGE_ACCOUNT_EXISTS',
    409,
  );

export const passwordAccountError = (): AppError =>
  new AppError(
    'This email already has an account with a password. Please sign in with it to book.',
    'CONCIERGE_PASSWORD_ACCOUNT',
    409,
  );

let defaultStore: ConciergeVerificationStore | null = null;

/** One store per process; codes are hashed with the concierge signing secret. */
export const getConciergeVerificationStore = (): ConciergeVerificationStore => {
  defaultStore ??= new ConciergeVerificationStore({
    secret: readConciergeSigningSecret(),
    sender: createConciergeEmailSender(),
  });
  return defaultStore;
};

/** Test hook: the next call builds a fresh store from the current environment. */
export const resetConciergeVerificationStore = (): void => {
  defaultStore = null;
};

export const startEmailVerification = async (
  email: string,
  dependencies: ConciergeIdentityDependencies = {},
): Promise<void> => {
  const store = dependencies.store ?? getConciergeVerificationStore();
  await store.start(email);
};

export const confirmEmailAndResolveIdentity = async (
  email: string,
  code: string,
  dependencies: ConciergeIdentityDependencies = {},
): Promise<ConciergeIdentity> => {
  const store = dependencies.store ?? getConciergeVerificationStore();
  const findUser = dependencies.findUser ?? findUserByEmail;
  store.confirm(email, code);

  const existing = await findUser(email);
  if (!existing) {
    return { kind: 'new_email', verificationToken: await signVerifiedEmail(email) };
  }
  if (!canBookAsPetOwner(existing)) {
    throw new AppError(
      'This email belongs to a staff account. Please use a personal email to book.',
      'CONCIERGE_STAFF_EMAIL',
      409,
    );
  }
  const hasPassword = dependencies.hasPassword ?? emailHasPasswordAccount;
  if (await hasPassword(email)) {
    throw passwordAccountError();
  }
  return { kind: 'existing_owner', ownerId: existing.id };
};
