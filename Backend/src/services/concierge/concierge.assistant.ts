import type {
  ConciergeAssistantMode,
  ConciergeChatMessage,
  ConciergeLocale,
  ConciergeNeedField,
  ConciergeNeeds,
  ConciergePlan,
} from '../../contracts/concierge.contract.js';
import type { ConciergeNeedsPatch } from './concierge.needs.js';
import type { ReplyLanguage } from '../../common/language/detect.js';

/**
 * The conversational half of the concierge, behind one interface so the rules assistant (local
 * development, no cloud account) and the model assistants are interchangeable and testable.
 *
 * An assistant only ever returns words, needs patches and a plan. It cannot price, book, email or
 * read any account: the service applies the patches through `mergeNeeds` and builds and prices
 * the combos itself.
 */

/** What the model may know about a combo: what it contains and why it fits, never what it costs. */
export interface ComboDescription {
  id: string;
  /** Made from the contents, e.g. "Deluxe suite, House food and Daily walk". */
  name: string;
  /** Line names grouped per pet, e.g. [["Deluxe suite", "Premium food", "Daily walk"]]. */
  includesByPet: string[][];
  reason: string;
  recommended: boolean;
}

/** The services a guest can pick from, by name only; the panel shows the prices. */
export interface ServiceNamesByRole {
  rooms: string[];
  foods: string[];
  addons: string[];
}

export interface StayOptionsView {
  ready: boolean;
  missingFields: ConciergeNeedField[];
  combos: ComboDescription[];
  services: ServiceNamesByRole;
}

export interface AssistantTurnInput {
  messages: ConciergeChatMessage[];
  needs: ConciergeNeeds;
  /** The language of the hand-written copy in a reply (English or Chinese). */
  locale: ConciergeLocale;
  /**
   * The language of the guest's last message, which the model replies in. Defaults to `locale`;
   * it differs when a guest writes in, say, Korean on the English page.
   */
  replyLanguage?: ReplyLanguage;
  /** Today's date in New Zealand, so relative dates ("next Friday") resolve correctly. */
  today: string;
  /**
   * Whether a pet parent is signed in. A guest is told, once and in passing, that signing in gets
   * them a plan from their earlier stays and a one-tap booking; a parent is not nagged.
   */
  signedIn?: boolean;
  /** Read-only view of what would be offered for a set of needs. */
  describeOptions: (needs: ConciergeNeeds) => Promise<StayOptionsView>;
  /**
   * The booking rules as text (fee tiers and the current terms), so a policy answer quotes the
   * document the guest will agree to instead of the model's memory. Optional for callers that
   * never ask about policy, such as the rules assistant's tests.
   */
  describeRules?: () => Promise<string>;
}

export interface AssistantTurnResult {
  reply: string;
  needsPatches: ConciergeNeedsPatch[];
  /** The fit and the book-it hand-off, once the options are ready; omitted or null before. */
  plan?: ConciergePlan | null;
}

export interface ConciergeAssistant {
  readonly mode: ConciergeAssistantMode;
  respond(input: AssistantTurnInput): Promise<AssistantTurnResult>;
  /**
   * One plain call to the assistant's model, used to translate fixed reply lines for a language
   * that has no hand-written copy. Absent when the assistant has no model (the rules assistant).
   */
  translate?(system: string, prompt: string): Promise<string>;
}

/** The model failed in a way the guest can work around (the checklist still quotes). */
export class ConciergeAssistantUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConciergeAssistantUnavailableError';
  }
}
