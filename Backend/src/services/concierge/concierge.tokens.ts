import { randomUUID } from 'node:crypto';
import type { JWTPayload } from 'jose';
import { z } from 'zod';
import {
  CONCIERGE_CURRENCY,
  CONCIERGE_PET_SIZES,
  CONCIERGE_SPECIES,
  conciergeSelectionSchema,
} from '../../contracts/concierge.contract.js';
import {
  createSignedSessionToken,
  verifySignedSessionToken,
} from '../../common/utils/signed-session.js';
import { AppError } from '../../common/middlewares/error.middleware.js';
import type { UnsignedQuote } from './concierge.quotes.js';

/**
 * Signed, short-lived proofs that let the concierge stay stateless.
 *
 * - A quote token proves which lines and total the server offered.
 * - An accepted-quote token proves the guest agreed to that quote, and when.
 * - A verified-email token proves the guest controls an email address.
 *
 * None of them are stored. Each carries a `typ` claim so one kind can never be replayed as
 * another, and all are signed with `CONCIERGE_SIGNING_SECRET`, separate from the session secret so
 * rotating one never logs everyone out or voids every quote.
 */

export const QUOTE_TTL_SECONDS = 30 * 60;
export const ACCEPTED_QUOTE_TTL_SECONDS = 60 * 60;
/** As long as an acceptance, so a guest who verified early never has to verify again to send. */
export const VERIFIED_EMAIL_TTL_SECONDS = 60 * 60;

const TOKEN_TYPES = {
  quote: 'concierge_quote',
  acceptedQuote: 'concierge_accepted_quote',
  verifiedEmail: 'concierge_verified_email',
} as const;

/** A secret shorter than this is guessable enough to forge quotes and verified-email tokens. */
export const MIN_SIGNING_SECRET_LENGTH = 32;
/** The value published in Backend/.env.example; a server that still uses it is not configured. */
export const EXAMPLE_SIGNING_SECRET = 'a_long_random_secret_for_concierge_tokens';

/** The signing secret, refused when missing, too short, or copied from the example file. */
export const readConciergeSigningSecret = (): string => {
  const secret = process.env.CONCIERGE_SIGNING_SECRET;
  if (!secret || secret.length < MIN_SIGNING_SECRET_LENGTH || secret === EXAMPLE_SIGNING_SECRET) {
    throw new AppError(
      'Online booking is not configured on this server yet.',
      'CONCIERGE_NOT_CONFIGURED',
      503,
    );
  }
  return secret;
};

const getSigningSecret = (): Uint8Array => new TextEncoder().encode(readConciergeSigningSecret());

const quotedPetSchema = z.object({
  species: z.enum(CONCIERGE_SPECIES),
  size: z.enum(CONCIERGE_PET_SIZES).nullable(),
  needsMedication: z.boolean().nullable(),
  firstTimeBoarding: z.boolean().nullable(),
  name: z.string().max(60).optional(),
});

const quotedLineSchema = z.object({
  serviceId: z.string().uuid(),
  petIndex: z.number().int().min(0),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  lineTotal: z.number().nonnegative(),
});

/** A name is made of catalogue names; the cap keeps a token small enough for a header. */
const MAX_QUOTE_NAME_LENGTH = 400;

const quotePayloadSchema = z.object({
  name: z.string().min(1).max(MAX_QUOTE_NAME_LENGTH),
  selection: conciergeSelectionSchema,
  startDate: z.string(),
  endDate: z.string(),
  nights: z.number().int().positive(),
  pets: z.array(quotedPetSchema).min(1),
  lines: z.array(quotedLineSchema).min(1),
  total: z.number().nonnegative(),
  currency: z.literal(CONCIERGE_CURRENCY),
});

export type SignedQuote = z.infer<typeof quotePayloadSchema>;

interface QuoteClaims extends JWTPayload {
  typ: string;
  quote: SignedQuote;
}

interface AcceptedQuoteClaims extends QuoteClaims {
  acceptedAt: string;
  /** Unique per acceptance, so checkout can refuse to book the same agreement twice. */
  jti: string;
}

const isQuoteClaims =
  (expectedType: string) =>
  (payload: JWTPayload): payload is QuoteClaims =>
    payload.typ === expectedType && quotePayloadSchema.safeParse(payload.quote).success;

const isAcceptedQuoteClaims = (payload: JWTPayload): payload is AcceptedQuoteClaims =>
  isQuoteClaims(TOKEN_TYPES.acceptedQuote)(payload) &&
  typeof payload.acceptedAt === 'string' &&
  typeof payload.jti === 'string';

const isVerifiedEmailClaims = (payload: JWTPayload): payload is JWTPayload & { sub: string } =>
  payload.typ === TOKEN_TYPES.verifiedEmail && typeof payload.sub === 'string';

/** Which proof failed, so the page can recover the right way (re-quote, re-agree or re-verify). */
export type ConciergeTokenKind = 'quote' | 'accepted_quote' | 'verified_email';

const TOKEN_DESCRIPTIONS: Record<ConciergeTokenKind, string> = {
  quote: 'quote',
  accepted_quote: 'accepted quote',
  verified_email: 'email verification',
};

const invalidToken = (token: ConciergeTokenKind): AppError =>
  new AppError(
    `This ${TOKEN_DESCRIPTIONS[token]} has expired or is not valid. Please start again.`,
    'CONCIERGE_TOKEN_INVALID',
    410,
    [{ token }],
  );

export const toSignedQuote = (
  quote: UnsignedQuote,
  startDate: string,
  endDate: string,
  pets: SignedQuote['pets'],
): SignedQuote => ({
  name: quote.name.slice(0, MAX_QUOTE_NAME_LENGTH),
  selection: quote.selection,
  startDate,
  endDate,
  nights: quote.nights,
  pets,
  lines: quote.lines.map(({ serviceId, petIndex, quantity, unitPrice, lineTotal }) => ({
    serviceId,
    petIndex,
    quantity,
    unitPrice,
    lineTotal,
  })),
  total: quote.total,
  currency: CONCIERGE_CURRENCY,
});

export const signQuote = async (
  quote: SignedQuote,
  issuedAt: Date = new Date(),
): Promise<{ token: string; expiresAt: string }> => {
  const token = await createSignedSessionToken({
    subject: TOKEN_TYPES.quote,
    secret: getSigningSecret(),
    ttlSeconds: QUOTE_TTL_SECONDS,
    claims: { typ: TOKEN_TYPES.quote, quote },
    issuedAt,
  });
  const expiresAt = new Date(issuedAt.getTime() + QUOTE_TTL_SECONDS * 1000).toISOString();
  return { token, expiresAt };
};

export const verifyQuote = async (token: string): Promise<SignedQuote> => {
  try {
    const claims = await verifySignedSessionToken({
      token,
      secret: getSigningSecret(),
      requiredClaims: ['typ', 'quote', 'exp'],
      invalidClaimsMessage: 'Invalid concierge quote',
      isValidClaims: isQuoteClaims(TOKEN_TYPES.quote),
    });
    return claims.quote;
  } catch (error: unknown) {
    if (error instanceof AppError) throw error;
    throw invalidToken('quote');
  }
};

export const signAcceptedQuote = async (
  quote: SignedQuote,
  acceptedAt: Date = new Date(),
): Promise<string> =>
  createSignedSessionToken({
    subject: TOKEN_TYPES.acceptedQuote,
    secret: getSigningSecret(),
    ttlSeconds: ACCEPTED_QUOTE_TTL_SECONDS,
    claims: {
      typ: TOKEN_TYPES.acceptedQuote,
      quote,
      acceptedAt: acceptedAt.toISOString(),
      jti: randomUUID(),
    },
    issuedAt: acceptedAt,
  });

export const verifyAcceptedQuote = async (
  token: string,
): Promise<{
  quote: SignedQuote;
  acceptedAt: string;
  name: string;
  acceptanceId: string;
}> => {
  try {
    const claims = await verifySignedSessionToken({
      token,
      secret: getSigningSecret(),
      requiredClaims: ['typ', 'quote', 'acceptedAt', 'jti', 'exp'],
      invalidClaimsMessage: 'Invalid accepted concierge quote',
      isValidClaims: isAcceptedQuoteClaims,
    });
    return {
      quote: claims.quote,
      acceptedAt: claims.acceptedAt,
      name: claims.quote.name,
      acceptanceId: claims.jti,
    };
  } catch (error: unknown) {
    if (error instanceof AppError) throw error;
    throw invalidToken('accepted_quote');
  }
};

export const signVerifiedEmail = async (
  email: string,
  issuedAt: Date = new Date(),
): Promise<string> =>
  createSignedSessionToken({
    subject: email,
    secret: getSigningSecret(),
    ttlSeconds: VERIFIED_EMAIL_TTL_SECONDS,
    claims: { typ: TOKEN_TYPES.verifiedEmail },
    issuedAt,
  });

export const verifyVerifiedEmail = async (token: string): Promise<string> => {
  try {
    const claims = await verifySignedSessionToken({
      token,
      secret: getSigningSecret(),
      requiredClaims: ['typ', 'sub', 'exp'],
      invalidClaimsMessage: 'Invalid concierge email verification',
      isValidClaims: isVerifiedEmailClaims,
    });
    return claims.sub;
  } catch (error: unknown) {
    if (error instanceof AppError) throw error;
    throw invalidToken('verified_email');
  }
};
