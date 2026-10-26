// Frontend mirror of Backend/src/contracts/concierge.contract.ts. Keep the two in step: the
// Backend validates every request with zod, so a drifted field fails loudly with a 400.

export type ConciergeLocale = 'en' | 'zh';
export type ConciergeSpecies = 'dog' | 'cat' | 'other';
export type ConciergePetSize = 'small' | 'medium' | 'large';
export type ConciergeNeedField = 'service' | 'dates' | 'pets' | 'species' | 'size';
export type ConciergeAssistantMode = 'claude' | 'rules' | 'openai';
export type ConciergeTurnTrigger = 'message' | 'checklist' | 'choice';
export type ConciergeServiceCategory = 'boarding_rate' | 'food' | 'addon';

export const CONCIERGE_MAX_PETS = 4;

export interface ConciergePetNeed {
  name?: string;
  species: ConciergeSpecies | null;
  size: ConciergePetSize | null;
  needsMedication: boolean | null;
  firstTimeBoarding: boolean | null;
}

export interface ConciergeExtras {
  walks: boolean;
  grooming: boolean;
  playtime: boolean;
}

export interface ConciergeNeeds {
  service: 'boarding' | null;
  startDate: string | null;
  endDate: string | null;
  pets: ConciergePetNeed[];
  extras: ConciergeExtras;
  notes: string;
}

export interface ConciergeChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

export interface ConciergeChatRequest {
  messages: ConciergeChatMessage[];
  needs: ConciergeNeeds;
  locale: ConciergeLocale;
  trigger: ConciergeTurnTrigger;
}

/**
 * One pet's choice, by catalogue id: exactly one room and one food, any add-ons. The server adds
 * what the catalogue marks compulsory and medication handling for a pet that needs it.
 */
export interface ConciergePetSelection {
  roomId: string;
  foodId: string;
  addonIds: string[];
}

/** One entry per pet in `needs.pets`, in the same order. */
export interface ConciergeSelection {
  pets: ConciergePetSelection[];
}

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

/** Every bookable service grouped the way a pet's selection is made, cheapest first. */
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
  /** Built from the contents ("Deluxe suite, House food and Daily walk"), never a tier label. */
  name: string;
  selection: ConciergeSelection;
  nights: number;
  lines: ConciergeQuoteLine[];
  /** GST-inclusive total in dollars; the only price the interface shows as the price. */
  total: number;
  currency: 'NZD';
  gstInclusive: true;
  quoteToken: string;
  expiresAt: string;
}

/**
 * A suggested combination built from the stated needs. Advice only: the guest can take it as is
 * or change any line in the stay panel, and the server prices whatever they end up with.
 */
export interface ConciergeCombo {
  /** Stable for the same contents, so a recommendation can point at it across turns. */
  id: string;
  quote: ConciergeQuote;
  /** One sentence on why it fits what the guest said, in the guest's language; never price. */
  reason: string;
  /** Exactly one combo is marked. */
  recommended: boolean;
}

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
 * whether the guest asked the assistant to book. Advice only: the page applies the combo and
 * prefills the form; the guest checks the stay, agrees to the terms and presses Send themselves.
 */
export interface ConciergePlan {
  /** The id of the combo in `combos` the assistant recommends, or null for none. */
  recommendedComboId: string | null;
  /** One sentence on fit, never on price. */
  reason: string | null;
  bookRequested: boolean;
  prefill: ConciergePlanPrefill | null;
}

export interface ConciergeChatResponse {
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
  assistantAvailable: boolean;
  /** Nights (YYYY-MM-DD) with no room for these pets; `combos` is empty when any is full. */
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

/** GET /api/concierge/last-stay: signed-in pet parents only. */
export interface ConciergeLastStayResponse {
  lastStay: ConciergeLastStay | null;
}

/** POST /api/concierge/price: the live total of a stay the guest built by hand. */
export interface ConciergePriceRequest {
  needs: ConciergeNeeds;
  selection: ConciergeSelection;
  locale: ConciergeLocale;
}

export interface ConciergePriceResponse {
  quote: ConciergeQuote;
}

/** GET /api/concierge/rates: the cheapest bookable stay (one pet, one night, the simplest combo). */
export interface ConciergeRatesResponse {
  fromTotal: number;
  nights: 1;
  currency: 'NZD';
  gstInclusive: true;
}

/** GET /api/concierge/terms: the full booking terms the checkbox agrees to. */
export interface ConciergeTermsResponse {
  version: string;
  content: string;
}

/**
 * The fee rules the page states for a new booking; the server charges by the same numbers. Between
 * `shortNoticeHours` and `freeCancellationHours` a cancellation costs one night per pet, never more
 * than `shortNoticeFeePercent` of its stay. Dates can change as often as needed before drop-off.
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

export type ConciergeCardProcessor = 'stripe' | 'fake';

/**
 * Where a guest's words are processed, as the server is configured now: provider kinds and AWS
 * region codes only. Mirrors AiProcessingDisclosure in Backend/src/contracts/concierge.contract.ts.
 * `assistant` is null when the server does not know the configured provider.
 */
export type AssistantProcessingKind = 'rules' | 'bedrock' | 'anthropic' | 'other';
export type SpeechProcessingKind = 'whisper' | 'transcribe' | 'off';
export type ParentChatProcessingKind = 'bedrock' | 'other' | 'off';

export interface AssistantProcessing {
  kind: AssistantProcessingKind;
  region: string | null;
}

export interface SpeechProcessing {
  kind: SpeechProcessingKind;
  region: string | null;
}

export interface AiProcessingDisclosure {
  assistant: AssistantProcessing | null;
  speech: SpeechProcessing;
  parentChat: { kind: ParentChatProcessingKind; region: string | null };
}

/** GET /api/concierge/status: what the page needs to know before the guest starts. */
export interface ConciergeStatusResponse {
  /** Still reported by the server; the page signs guests in with a password instead of a code. */
  emailCodes: boolean;
  contact: { email: string | null; phone: string | null };
  /** Null processor: cards cannot be saved, so booking online is off. */
  cardPayments: { processor: ConciergeCardProcessor | null; testMode: boolean };
  /** False when no facility capacity exists: nothing can be priced or booked online. */
  capacityConfigured: boolean;
  policy: ConciergeBookingPolicy;
  /** Who answers the chat: a keyword matcher or a model; null when the server cannot start it. */
  assistantMode: ConciergeAssistantMode | null;
  /** Where the assistant and voice-to-text run; the privacy notice is written from it. */
  aiProcessing: AiProcessingDisclosure;
}

/**
 * POST /api/concierge/details/read: what a spoken or typed description said, for the guest to
 * confirm before it fills the form. Null where it said nothing (Backend concierge.details-reader.ts).
 */
export interface ConciergeDetailsDraft {
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  address: string | null;
  emergencyContactNumber: string | null;
  pets: Array<{ name: string | null; breed: string | null }> | null;
  careNotes: string | null;
}

export interface ConciergeAcceptQuoteResponse {
  acceptedQuoteToken: string;
  acceptedAt: string;
  /** The quote's name, built from its contents, for the summary and the receipt. */
  name: string;
  total: number;
}

export type ConciergeCheckoutPet =
  { existingPetId: string } | { newPet: { name: string; breed?: string } };

/** A new guest's own details: optional emergency contact and home address. */
export interface ConciergeContact {
  firstName: string;
  lastName: string;
  address?: string;
  emergencyContactNumber?: string;
  /** The guest's own mobile, so the facility can reach them about the stay. */
  phone: string;
}

export interface ConciergeCheckoutRequest {
  acceptedQuoteToken: string;
  verificationToken?: string;
  /** A first-time guest's account, made with the booking (Backend contracts/concierge.contract.ts). */
  newAccount?: { email: string; password: string };
  contact?: ConciergeContact;
  pets: ConciergeCheckoutPet[];
  stay: { dropOffTime: string; pickUpTime: string };
  agreement: { termsAccepted: true; vetConsentAccepted: true; termsVersionLabel: string };
  careNotes?: string;
}

/** What the owner brings or signs at the desk on drop-off day. */
export type ConciergeSafetyTask = 'vaccination_certificate' | 'emergency_vet_consent';

export interface ConciergeCheckoutResponse {
  bookingId: string;
  /** One per quoted pet, in quote order; empty when the server could not read them back. */
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
  currency: 'NZD';
  accountCreated: boolean;
  safetyTasks: ConciergeSafetyTask[];
  payment: ConciergeCheckoutPayment;
}

/**
 * Nothing is paid online (Backend concierge.contract.ts): our manager decides by `reviewBy`, and
 * the guest pays `amount` at the desk after the arrival health check.
 */
export interface ConciergeCheckoutPayment {
  status: 'pay_at_desk';
  amount: number;
  reviewBy: string;
}

/** Why a manager checks a pet's stay before it is confirmed (Backend booking.review.contract.ts). */
export type ManagerReviewReason = 'medication';

export type ConciergeCheckoutStatus =
  'confirmed' | 'partly_confirmed' | 'awaiting_manager_approval';

export interface ConciergeCheckoutPetResult {
  name: string;
  status: 'confirmed' | 'waiting_for_review';
  /** Why a manager checks this stay first; empty when it is confirmed. */
  reviewReasons: ManagerReviewReason[];
}

/** Where the guest is in the flow; each step is one screen. */
export type ConciergeStep = 'plan' | 'verify' | 'details' | 'done';

/** Which signed proof the server refused (details of CONCIERGE_TOKEN_INVALID). */
export type ConciergeTokenKind = 'quote' | 'accepted_quote' | 'verified_email';

export interface ConciergeUiMessage extends ConciergeChatMessage {
  id: string;
  /** Messages the assistant could not answer are shown with a notice style. */
  tone?: 'notice';
  /** Shown to the guest but never sent to the server (the greeting, outage notices). */
  localOnly?: true;
  /** The reply that brought the suggested stays; a chip under it opens the stay panel. */
  offersStay?: true;
}
