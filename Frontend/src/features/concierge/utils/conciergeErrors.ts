import { ApiError } from '../../pet-parent/api/bookingApi';
import type { ConciergeCopy } from '../copy';
import type { ConciergeTokenKind } from '../types';

/**
 * Turns a failed concierge request into words for the guest, in their language, plus what the
 * page needs to recover: which signed proof expired, the reference of a request already sent,
 * how long to wait, or which form fields the server refused.
 *
 * The server's own message is never shown: it is English only, and "Failed to fetch" means
 * nothing to a guest on a train.
 */

export interface ConciergeProblem {
  message: string;
  code: string | null;
  status: number | null;
  /** Set for CONCIERGE_TOKEN_INVALID: which proof has expired. */
  token: ConciergeTokenKind | null;
  /** Set for CONCIERGE_ALREADY_SUBMITTED: the booking this acceptance already made. */
  confirmationNumber: string | null;
  retryAfterSeconds: number | null;
  /** Dotted field paths from a validation failure, e.g. "contact.phone". */
  fields: string[];
}

interface ErrorBody {
  code?: unknown;
  details?: unknown;
}

const errorBody = (error: ApiError): ErrorBody => {
  const body = error.body;
  if (body && typeof body === 'object' && 'error' in body) {
    const inner = (body as { error: unknown }).error;
    if (inner && typeof inner === 'object') return inner as ErrorBody;
  }
  return {};
};

const detailsOf = (body: ErrorBody): Array<Record<string, unknown>> =>
  Array.isArray(body.details)
    ? body.details.filter(
        (detail): detail is Record<string, unknown> => !!detail && typeof detail === 'object',
      )
    : [];

const firstDetail = <T>(
  details: Array<Record<string, unknown>>,
  key: string,
  isType: (value: unknown) => value is T,
): T | null => {
  for (const detail of details) {
    const value = detail[key];
    if (isType(value)) return value;
  }
  return null;
};

const isString = (value: unknown): value is string => typeof value === 'string';
const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const TOKEN_KINDS: readonly ConciergeTokenKind[] = ['quote', 'accepted_quote', 'verified_email'];
const isTokenKind = (value: unknown): value is ConciergeTokenKind =>
  typeof value === 'string' && (TOKEN_KINDS as readonly string[]).includes(value);

const messageFor = (
  code: string | null,
  status: number | null,
  copy: ConciergeCopy,
  extra: { confirmationNumber: string | null; retryAfterSeconds: number | null },
): string => {
  const { errors } = copy;
  switch (code) {
    case 'CONCIERGE_NOT_CONFIGURED':
      return errors.notConfigured;
    case 'CONCIERGE_CATALOGUE_INCOMPLETE':
      return errors.catalogueIncomplete;
    case 'CONCIERGE_EMAIL_NOT_CONFIGURED':
      return errors.emailNotConfigured;
    case 'CONCIERGE_CODE_INVALID':
      return errors.codeInvalid;
    case 'CONCIERGE_CODE_COOLDOWN':
      return errors.codeCooldown(extra.retryAfterSeconds ?? 60);
    case 'CONCIERGE_CODE_TOO_MANY':
      return errors.codeTooMany;
    case 'CONCIERGE_CODE_LOCKED':
      return errors.codeLocked;
    case 'CONCIERGE_STAFF_EMAIL':
      return errors.staffEmail;
    case 'CONCIERGE_EMAIL_TAKEN':
      return errors.emailTaken;
    case 'CONCIERGE_ALREADY_SUBMITTED':
      return errors.alreadySubmitted(extra.confirmationNumber ?? '');
    case 'CONCIERGE_SUBMISSION_IN_PROGRESS':
      return errors.inProgress;
    case 'CONCIERGE_QUOTE_STALE':
      return errors.quoteStale;
    case 'CONCIERGE_TOKEN_INVALID':
      return errors.quoteExpired;
    case 'CONCIERGE_SELECTION_INVALID':
      return errors.selectionInvalid;
    case 'CONCIERGE_FULLY_BOOKED':
      return errors.fullyBooked;
    case 'CONCIERGE_PET_COUNT_MISMATCH':
      return errors.petCountMismatch;
    case 'CONCIERGE_PET_NOT_OWNED':
      return errors.petNotOwned;
    case 'CONCIERGE_PET_DUPLICATED':
      return errors.petDuplicated;
    case 'CONCIERGE_CONTACT_REQUIRED':
      return errors.contactRequired;
    case 'CONCIERGE_EMAIL_UNVERIFIED':
      return errors.emailUnverified;
    case 'CONCIERGE_PASSWORD_ACCOUNT':
      return errors.passwordAccount;
    case 'CONCIERGE_ACCOUNT_EXISTS':
      return errors.accountExists;
    case 'CONCIERGE_PASSWORD_INVALID':
      return errors.passwordInvalid;
    case 'CONCIERGE_PET_SPECIES_MISMATCH':
      return errors.petSpeciesMismatch;
    case 'VALIDATION_FAILED':
      return errors.validation;
    case 'TERMS_VERSION_CHANGED':
      return errors.termsChanged;
    case 'TERMS_UNAVAILABLE':
      return errors.termsUnavailable;
    case 'AGREEMENT_NAME_MISSING':
      return errors.nameMissing;
    default:
      if (status === 429) return errors.rateLimited;
      return errors.generic;
  }
};

export const describeConciergeError = (error: unknown, copy: ConciergeCopy): ConciergeProblem => {
  if (!(error instanceof ApiError)) {
    // fetch rejects with a TypeError when the network is down or the server cannot be reached.
    const network = error instanceof TypeError;
    return {
      message: network ? copy.errors.network : copy.errors.generic,
      code: null,
      status: null,
      token: null,
      confirmationNumber: null,
      retryAfterSeconds: null,
      fields: [],
    };
  }
  const body = errorBody(error);
  const code = isString(body.code) ? body.code : null;
  const details = detailsOf(body);
  const confirmationNumber = firstDetail(details, 'confirmationNumber', isString);
  const retryAfterSeconds = firstDetail(details, 'retryAfterSeconds', isNumber);
  const fields = details.flatMap((detail) => (isString(detail.field) ? [detail.field] : []));
  return {
    message: messageFor(code, error.status, copy, { confirmationNumber, retryAfterSeconds }),
    code,
    status: error.status,
    token: firstDetail(details, 'token', isTokenKind),
    confirmationNumber,
    retryAfterSeconds,
    fields,
  };
};
