import { z } from 'zod';
import { isValidPhoneNumber, PHONE_FORMAT_MESSAGE } from '../common/utils/phone.js';
import type { ManagerReviewReason } from './booking.review.contract.js';

/**
 * Wire contract for the public AI booking concierge (`/api/concierge`).
 *
 * The concierge is stateless on the server: every chat turn carries the conversation so far and
 * the structured needs gathered so far, and the reply carries the updated needs back. Nothing a
 * guest types is stored until they check out, which keeps the pre-booking conversation out of the
 * database entirely (privacy notice: "non-booking conversations are not kept").
 *
 * Prices never come from the model. A stay is a selection per pet (one room, one food, any add-ons)
 * priced by deterministic code from the service catalogue; the server also suggests two or three
 * combos built from the stated needs. Every priced selection travels with a signed quote token so
 * the checkout can prove the price the guest agreed to.
 */

export const CONCIERGE_SERVICES = ['boarding'] as const;
export const CONCIERGE_SPECIES = ['dog', 'cat', 'other'] as const;
export const CONCIERGE_PET_SIZES = ['small', 'medium', 'large'] as const;
export const CONCIERGE_LOCALES = ['en', 'zh'] as const;

/** The fields the concierge needs before it can quote, in the order it asks for them. */
export const CONCIERGE_NEED_FIELDS = ['service', 'dates', 'pets', 'species', 'size'] as const;

export const CONCIERGE_MAX_PETS = 4;
export const CONCIERGE_MAX_STAY_NIGHTS = 60;
export const CONCIERGE_MAX_MESSAGES = 30;
export const CONCIERGE_MAX_MESSAGE_LENGTH = 2000;
export const CONCIERGE_MAX_ADDONS_PER_PET = 20;
export const CONCIERGE_CURRENCY = 'NZD';

export type ConciergeService = (typeof CONCIERGE_SERVICES)[number];
export type ConciergeSpecies = (typeof CONCIERGE_SPECIES)[number];
export type ConciergePetSize = (typeof CONCIERGE_PET_SIZES)[number];
export type ConciergeLocale = (typeof CONCIERGE_LOCALES)[number];
export type ConciergeNeedField = (typeof CONCIERGE_NEED_FIELDS)[number];

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected an ISO date (YYYY-MM-DD)');
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected a time in HH:mm format');

export const conciergePetNeedSchema = z.object({
  name: z.string().trim().max(60).optional(),
  species: z.enum(CONCIERGE_SPECIES).nullable(),
  size: z.enum(CONCIERGE_PET_SIZES).nullable(),
  needsMedication: z.boolean().nullable(),
  firstTimeBoarding: z.boolean().nullable(),
});

export const conciergeExtrasSchema = z.object({
  walks: z.boolean(),
  grooming: z.boolean(),
  playtime: z.boolean(),
});

export const conciergeNeedsSchema = z.object({
  service: z.enum(CONCIERGE_SERVICES).nullable(),
  startDate: isoDateSchema.nullable(),
  endDate: isoDateSchema.nullable(),
  pets: z.array(conciergePetNeedSchema).max(CONCIERGE_MAX_PETS),
  extras: conciergeExtrasSchema,
  notes: z.string().max(500),
});

export type ConciergePetNeed = z.infer<typeof conciergePetNeedSchema>;
export type ConciergeExtras = z.infer<typeof conciergeExtrasSchema>;
export type ConciergeNeeds = z.infer<typeof conciergeNeedsSchema>;

export const conciergeChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  text: z.string().trim().min(1).max(CONCIERGE_MAX_MESSAGE_LENGTH),
});

export type ConciergeChatMessage = z.infer<typeof conciergeChatMessageSchema>;

/**
 * `message`: the guest sent a chat message, so the assistant answers it.
 * `checklist`: the guest changed the tick-box checklist; needs and packages are refreshed without
 * asking the assistant to answer the last message again.
 * `choice`: the guest tapped an answer button. The tap already changed the needs, so no model is
 * asked; the reply is the fixed next question (or the note that options are ready).
 */
export const CONCIERGE_TURN_TRIGGERS = ['message', 'checklist', 'choice'] as const;

export const conciergeChatRequestSchema = z.object({
  messages: z.array(conciergeChatMessageSchema).max(CONCIERGE_MAX_MESSAGES),
  needs: conciergeNeedsSchema,
  locale: z.enum(CONCIERGE_LOCALES),
  trigger: z.enum(CONCIERGE_TURN_TRIGGERS).default('message'),
});

export type ConciergeChatRequest = z.infer<typeof conciergeChatRequestSchema>;

export type ConciergeServiceCategory = 'boarding_rate' | 'food' | 'addon';

/**
 * One pet's choice, by catalogue id: exactly one room and one food, any add-ons. The server adds
 * what the catalogue marks compulsory and medication handling for a pet that needs it, so a
 * selection never prices a stay the facility would not run.
 */
export const conciergePetSelectionSchema = z.object({
  roomId: z.string().uuid(),
  foodId: z.string().uuid(),
  addonIds: z.array(z.string().uuid()).max(CONCIERGE_MAX_ADDONS_PER_PET),
});

export const conciergeSelectionSchema = z.object({
  /** One entry per pet in `needs.pets`, in the same order. */
  pets: z.array(conciergePetSelectionSchema).min(1).max(CONCIERGE_MAX_PETS),
});

export type ConciergePetSelection = z.infer<typeof conciergePetSelectionSchema>;
export type ConciergeSelection = z.infer<typeof conciergeSelectionSchema>;

/** A catalogue row as the stay panel lists it: name and unit price, nothing about a person. */
export interface ConciergeCatalogueItem {
  id: string;
  name: string;
  category: ConciergeServiceCategory;
  description: string | null;
  unitPrice: number;
  priceUnit: string;
  /** Always on the stay; the panel shows it ticked and locked. */
  compulsory: boolean;
  /** Walks are for dogs only; the panel hides a dog-only add-on for a cat. */
  dogOnly: boolean;
}

/** Every bookable service grouped the way a pet's selection is made. */
export interface ConciergeCatalogue {
  rooms: ConciergeCatalogueItem[];
  foods: ConciergeCatalogueItem[];
  addons: ConciergeCatalogueItem[];
}

export interface ConciergeQuoteLine {
  serviceId: string;
  name: string;
  category: ConciergeServiceCategory;
  /** Index into `needs.pets`, so a line can say which pet it is for. */
  petIndex: number;
  quantity: number;
  unitPrice: number;
  priceUnit: string;
  lineTotal: number;
}

/** A priced, signed selection: what the guest would book and what it costs. */
export interface ConciergeQuote {
  /** Built from the contents ("Deluxe suite, house food and a daily walk"), never a tier label. */
  name: string;
  selection: ConciergeSelection;
  nights: number;
  lines: ConciergeQuoteLine[];
  /** GST-inclusive total in dollars; the only price the interface shows as the price. */
  total: number;
  currency: typeof CONCIERGE_CURRENCY;
  gstInclusive: true;
  quoteToken: string;
  expiresAt: string;
}

/**
 * A suggested combination built from the stated needs. It is advice: the guest can take it as is
 * or change any line in the stay panel, and the server prices whatever they end up with.
 */
export interface ConciergeCombo {
  /** Stable for the same contents, so a recommendation can point at it across turns. */
  id: string;
  quote: ConciergeQuote;
  /** One sentence on why it fits what the guest said, in the guest's language; never price. */
  reason: string;
  /** The best fit by the shared rule, or the assistant's own pick. Exactly one combo is marked. */
  recommended: boolean;
}

export type ConciergeAssistantMode = 'claude' | 'rules' | 'openai';

/** Details the guest stated in the chat, carried into the booking form for them to check. */
export interface ConciergePlanPrefill {
  firstName?: string;
  lastName?: string;
  phone?: string;
  /** "HH:mm" on a 24-hour clock. */
  dropOffTime?: string;
  pickUpTime?: string;
  careNotes?: string;
}

/**
 * The assistant's plan once the options are ready: which combo fits what the guest said, and
 * whether the guest asked the assistant to book. Advice only: the guest checks the stay, agrees to
 * the terms and presses Send themselves. Mirrored by Frontend/src/features/concierge/types.ts.
 */
export interface ConciergePlan {
  /** The id of the combo in `combos` the assistant recommends, or null for none. */
  recommendedComboId: string | null;
  /** One sentence on fit, never on price. */
  reason: string | null;
  /** The page applies the recommended combo and prefills the form, then waits for the guest. */
  bookRequested: boolean;
  prefill: ConciergePlanPrefill | null;
}

export interface ConciergeChatResponse {
  /** Empty for a `checklist` turn: there is no new message to answer. */
  reply: string;
  needs: ConciergeNeeds;
  missingFields: ConciergeNeedField[];
  /** Two or three suggested stays once the needs are complete and every night has room. */
  combos: ConciergeCombo[];
  /** Every bookable service with its price, so the guest can build a stay of their own. */
  catalogue: ConciergeCatalogue;
  assistantMode: ConciergeAssistantMode;
  /** Null until the options are ready, or when the assistant made no recommendation. */
  plan: ConciergePlan | null;
  /** False when the model could not answer; the checklist and combos still work. */
  assistantAvailable: boolean;
  /**
   * Nights (YYYY-MM-DD) of the planned stay that cannot take these pets. When any night is full,
   * `combos` is empty and the reply says so.
   */
  fullNights: string[];
  /** Set on the turn that copied a signed-in parent's last stay; the page applies its selection. */
  lastStay: ConciergeLastStay | null;
}

/**
 * A signed-in parent's latest stay, copied for "same as last time": the pets and the services,
 * never the dates (those are always asked). `selection` holds only services still in the
 * catalogue; a retired room or food falls back to the cheapest one.
 */
export interface ConciergeLastStay {
  confirmationNumber: string;
  /** The dates of that earlier stay, for the reply only. */
  startDate: string;
  endDate: string;
  /** Service, pets and extras filled in; dates left empty. */
  needs: ConciergeNeeds;
  selection: ConciergeSelection;
  /** The saved pet profile for each pet, in `needs.pets` order; null once deleted. */
  savedPetIds: (string | null)[];
}

export interface ConciergeLastStayResponse {
  lastStay: ConciergeLastStay | null;
}

/** Prices a stay the guest built by hand in the stay panel. */
export const conciergePriceRequestSchema = z.object({
  needs: conciergeNeedsSchema,
  selection: conciergeSelectionSchema,
  locale: z.enum(CONCIERGE_LOCALES),
});

export type ConciergePriceRequest = z.infer<typeof conciergePriceRequestSchema>;

export interface ConciergePriceResponse {
  quote: ConciergeQuote;
}

export const conciergeAcceptQuoteSchema = z.object({
  quoteToken: z.string().min(20).max(8000),
});

/**
 * The fee rules the page states for a new booking; the numbers come from booking.fee-policy.ts.
 * Between `shortNoticeHours` and `freeCancellationHours` a cancellation costs one night per pet,
 * never more than `shortNoticeFeePercent` of its stay. Dates can change as often as needed before
 * drop-off.
 */
export interface ConciergeBookingPolicy {
  /** Free this many hours or more before drop-off (7 days). */
  freeCancellationHours: number;
  /** Inside this many hours a cancellation or a no-show costs `shortNoticeFeePercent` of the stay. */
  shortNoticeHours: number;
  shortNoticeFeePercent: number;
  /** How long a request waits for our manager at most. */
  reviewWindowHours: number;
  lateFeeBasis: 'first_night';
}

/**
 * Where a guest's words are processed, as configured right now, so the privacy notice states it
 * instead of assuming it (Privacy Act 2020 IPP 3, Fair Trading Act s 13). Provider kinds and AWS
 * region codes only: never keys, endpoint URLs or model names. Built by
 * services/ai-processing-disclosure.ts; mirrored by Frontend/src/features/concierge/types.ts.
 *
 * - `assistant`: the booking assistant, which also translates its fixed reply lines. `bedrock`
 *   covers both Claude and the open models on Amazon Bedrock; `other` is an OpenAI-compatible
 *   endpoint that is not Bedrock. Null when the configured provider is not one the server knows.
 * - `speech`: voice-to-text. `off` when it is not configured correctly and cannot start.
 * - `parentChat`: the signed-in parent chat's model. `other` is any endpoint that is not Bedrock
 *   (the default is a local model); `off` when its configuration is invalid.
 */
export type AssistantProcessingKind = 'rules' | 'bedrock' | 'anthropic' | 'other';
export type SpeechProcessingKind = 'whisper' | 'transcribe' | 'off';
export type ParentChatProcessingKind = 'bedrock' | 'other' | 'off';

export interface AiProcessingDisclosure {
  assistant: { kind: AssistantProcessingKind; region: string | null } | null;
  speech: { kind: SpeechProcessingKind; region: string | null };
  parentChat: { kind: ParentChatProcessingKind; region: string | null };
}

/** What the page needs before a guest starts; read before the first question. */
export interface ConciergeStatusResponse {
  emailCodes: boolean;
  contact: { email: string | null; phone: string | null };
  /** How cards are handled: Stripe, the development fake, or null when booking online is off. */
  cardPayments: { processor: 'stripe' | 'fake' | null; testMode: boolean };
  /**
   * Whether exactly one facility with a pets-per-night capacity exists. Without it no stay can be
   * priced or booked, so the page says so before the first question instead of after the last.
   */
  capacityConfigured: boolean;
  policy: ConciergeBookingPolicy;
  /**
   * Which assistant answers the chat: the rules assistant (no model) or Claude on Bedrock. Null
   * when the configured assistant cannot start, so the page can say so before the first turn. The
   * greeting is written from this, so it never calls a keyword matcher an AI.
   */
  assistantMode: ConciergeAssistantMode | null;
  /** Where the assistant, voice-to-text and the parent chat run; the privacy notice says this. */
  aiProcessing: AiProcessingDisclosure;
}

/** The public "from" price: the cheapest bookable stay (one pet, one night, the simplest combo). */
export interface ConciergeRatesResponse {
  fromTotal: number;
  nights: 1;
  currency: typeof CONCIERGE_CURRENCY;
  gstInclusive: true;
}

/** The full booking terms the checkbox agrees to; the checkout sends `version` back. */
export interface ConciergeTermsResponse {
  version: string;
  content: string;
}

export interface ConciergeAcceptQuoteResponse {
  acceptedQuoteToken: string;
  acceptedAt: string;
  /** The quote's name, built from its contents, for the summary and the receipt. */
  name: string;
  total: number;
}

export const conciergeVerificationStartSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
});

export const conciergeVerificationConfirmSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  code: z.string().regex(/^\d{6}$/, 'Expected the 6-digit code'),
});

export type ConciergeVerificationResult =
  | { status: 'signed_in_existing_account' }
  | { status: 'verified_new_email'; verificationToken: string };

const newPetSchema = z.object({
  name: z.string().trim().min(1).max(100),
  breed: z.string().trim().max(100).optional(),
});

export const conciergeCheckoutPetSchema = z.union([
  z.object({ existingPetId: z.string().uuid() }),
  z.object({ newPet: newPetSchema }),
]);

/**
 * A new guest's own details. Optional emergency contact and home address: no law
 * requires either, and the Privacy Act (IPP 1) asks us to collect only what the booking needs.
 */
export const conciergeContactSchema = z.object({
  emergencyContactNumber: z
    .string()
    .trim()
    .max(30)
    .refine((value) => value === '' || isValidPhoneNumber(value), PHONE_FORMAT_MESSAGE)
    .optional(),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  address: z.string().trim().min(5).max(300).optional(),
  /** The product-wide phone rule, the same one signup and profiles use. */
  phone: z.string().trim().max(30).refine(isValidPhoneNumber, PHONE_FORMAT_MESSAGE),
});

/** The email a first-time guest books with; their account is made with it at checkout. */
const guestEmailSchema = z.string().trim().toLowerCase().email().max(254);

/**
 * A first-time guest's account, made when the booking is sent: no separate sign-up and no email
 * code. The password follows the sign-up rule (checked by the service, which knows the names).
 */
export const conciergeNewAccountSchema = z.object({
  email: guestEmailSchema,
  password: z.string().min(1).max(64),
});

export type ConciergeNewAccount = z.infer<typeof conciergeNewAccountSchema>;

/**
 * Asks for a card setup for one accepted quote, for the signed-in parent, a verified email or a
 * first-time guest's email (`guestEmail`).
 */
export const conciergeCardSetupSchema = z.object({
  acceptedQuoteToken: z.string().min(20).max(8000),
  verificationToken: z.string().min(20).max(4000).optional(),
  guestEmail: guestEmailSchema.optional(),
});

export type ConciergeCardSetupRequest = z.infer<typeof conciergeCardSetupSchema>;

export interface ConciergeCardSetupResponse {
  processor: 'stripe' | 'fake';
  setupId: string;
  /** For the card form in the browser, which confirms the setup with the processor. */
  clientSecret: string;
  /** Browser key for the Stripe card form; null in fake mode. */
  publishableKey: string | null;
  testMode: boolean;
}

export const conciergeCheckoutSchema = z.object({
  acceptedQuoteToken: z.string().min(20).max(8000),
  verificationToken: z.string().min(20).max(4000).optional(),
  /** A first-time guest's account, made with the booking (instead of signing in first). */
  newAccount: conciergeNewAccountSchema.optional(),
  /** The confirmed card setup that guarantees the booking. */
  cardSetupId: z.string().trim().min(8).max(255),
  contact: conciergeContactSchema.optional(),
  pets: z.array(conciergeCheckoutPetSchema).min(1).max(CONCIERGE_MAX_PETS),
  stay: z.object({ dropOffTime: timeSchema, pickUpTime: timeSchema }),
  /**
   * Two ticks, both required: the booking terms including the card hold, charges and fees, and the
   * emergency vet consent on its own (a separate tick is clearer evidence of that consent). The
   * agreement row records the version, the time and the account name; the server refuses a
   * request without either tick, so the row stands for both.
   */
  agreement: z.object({
    termsAccepted: z.literal(true),
    vetConsentAccepted: z.literal(true),
    termsVersionLabel: z.string().trim().min(1).max(40),
  }),
  /** Free-text care notes for staff; safety details are collected after payment. */
  careNotes: z.string().trim().max(1000).optional(),
});

export type ConciergeCheckoutRequest = z.infer<typeof conciergeCheckoutSchema>;
export type ConciergeCheckoutPet = z.infer<typeof conciergeCheckoutPetSchema>;
export type ConciergeContact = z.infer<typeof conciergeContactSchema>;

/**
 * What remains to bring on drop-off day. Emergency vet consent is given with its own tick when the
 * request is sent and recorded with the agreement, so nothing is signed at the desk.
 */
export const CONCIERGE_SAFETY_TASKS = ['vaccination_certificate'] as const;

export type ConciergeSafetyTask = (typeof CONCIERGE_SAFETY_TASKS)[number];

export interface ConciergeCheckoutResponse {
  bookingId: string;
  /** One per quoted pet, in quote order, for linking safety tasks; empty if it could not be read. */
  bookingPetIds: string[];
  confirmationNumber: string;
  /**
   * `confirmed` when every pet was confirmed at once; otherwise some or all pets wait for a
   * manager, and each of those says why in `pets`.
   */
  status: ConciergeCheckoutStatus;
  /** One per quoted pet, in quote order. */
  pets: ConciergeCheckoutPetResult[];
  total: number;
  currency: typeof CONCIERGE_CURRENCY;
  accountCreated: boolean;
  safetyTasks: ConciergeSafetyTask[];
  payment: ConciergeCheckoutPayment;
}

/**
 * What happened on the card. `charged`: every pet was confirmed, so their price was taken. `held`:
 * some pets wait for our manager; the full price is held until `reviewBy`, then the confirmed
 * pets are charged and the rest released.
 */
export interface ConciergeCheckoutPayment {
  status: 'charged' | 'held';
  amount: number;
  /** When our manager will have decided (24 hours, or drop-off if sooner); null once charged. */
  reviewBy: string | null;
  testMode: boolean;
}

export type ConciergeCheckoutStatus =
  'confirmed' | 'partly_confirmed' | 'awaiting_manager_approval';

export interface ConciergeCheckoutPetResult {
  name: string;
  status: 'confirmed' | 'waiting_for_review';
  /** Why a manager checks this stay first; empty when it is confirmed. */
  reviewReasons: ManagerReviewReason[];
}
