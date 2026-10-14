import type {
  ConciergeAssistantMode,
  ConciergeStatusResponse,
} from '../../contracts/concierge.contract.js';
import { isValidPhoneNumber } from '../../common/utils/phone.js';
import { readFacilityCapacity } from '../../repositories/booking.capacity.repository.js';
import { BOOKING_POLICY } from '../booking.fee-policy.js';
import { readAiProcessingDisclosure } from '../ai-processing-disclosure.js';
import type { CardProcessor } from '../payments/card-processor.js';
import { getCardProcessor } from '../payments/card-processor.factory.js';
import { createConciergeAssistant } from './concierge.assistant-factory.js';
import { createConciergeEmailSender } from './concierge.email.js';

/**
 * What the booking page needs to know before a guest starts, so nobody plans a stay and only then
 * finds a dead end:
 *
 * - `emailCodes`: whether a verification code can be sent at all. Without an email provider it is
 *   false, and the page offers "send this plan to our team" (and sign-in for existing owners)
 *   instead of an email step that would fail.
 * - `contact`: the team's real email and phone, from CONCIERGE_TEAM_EMAIL / CONCIERGE_TEAM_PHONE.
 *   A value that does not look right is left out rather than shown.
 * - `cardPayments`: whether a card can be saved, and whether it is a test, so the page never
 *   presents a test as a real hold on the guest's card.
 * - `policy`: the fee rules the page states, from the same numbers the server charges by.
 * - `assistantMode`: which assistant answers (rules or Bedrock), so the greeting tells the truth.
 * - `aiProcessing`: where the assistant, voice-to-text and the parent chat run, so the privacy
 *   notice names the services actually configured instead of a fixed claim.
 */

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const canSendEmail = (environment: Record<string, string | undefined>): boolean => {
  try {
    createConciergeEmailSender(environment);
    return true;
  } catch {
    return false;
  }
};

const cleaned = (value: string | undefined, isValid: (text: string) => boolean): string | null => {
  const trimmed = value?.trim();
  return trimmed && isValid(trimmed) ? trimmed : null;
};

/** The team's contact as guests see it: on the page, and in the booking emails. */
export const readTeamContact = (
  environment: Record<string, string | undefined> = process.env,
): ConciergeStatusResponse['contact'] => ({
  email: cleaned(environment.CONCIERGE_TEAM_EMAIL, (text) => EMAIL_SHAPE.test(text)),
  phone: cleaned(environment.CONCIERGE_TEAM_PHONE, isValidPhoneNumber),
});

/**
 * Whether the one facility and its capacity exist. A database error is not a missing capacity:
 * the page then behaves as before and the first priced turn reports the real problem.
 */
export const readCapacityConfigured = async (): Promise<boolean> => {
  try {
    return (await readFacilityCapacity()) !== null;
  } catch {
    return true;
  }
};

/**
 * The assistant that would answer the first turn, or null when the configured one cannot be built
 * (missing Bedrock credentials). Building it opens no connection; the Bedrock client is lazy.
 */
export const readAssistantMode = (
  environment: Record<string, string | undefined> = process.env,
): ConciergeAssistantMode | null => {
  try {
    return createConciergeAssistant(environment).mode;
  } catch {
    return null;
  }
};

export const getConciergeStatus = (
  environment: Record<string, string | undefined> = process.env,
  cardProcessor: CardProcessor | null = getCardProcessor(),
  capacityConfigured = true,
): ConciergeStatusResponse => ({
  emailCodes: canSendEmail(environment),
  contact: readTeamContact(environment),
  cardPayments: {
    processor: cardProcessor?.name ?? null,
    testMode: cardProcessor?.testMode ?? false,
  },
  capacityConfigured,
  policy: {
    freeCancellationHours: BOOKING_POLICY.freeCancellationHours,
    shortNoticeHours: BOOKING_POLICY.shortNoticeHours,
    shortNoticeFeePercent: BOOKING_POLICY.shortNoticeFeePercent,
    reviewWindowHours: BOOKING_POLICY.reviewWindowHours,
    lateFeeBasis: BOOKING_POLICY.lateFeeBasis,
  },
  assistantMode: readAssistantMode(environment),
  aiProcessing: readAiProcessingDisclosure(environment),
});
