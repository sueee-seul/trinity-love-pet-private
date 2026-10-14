import type {
  ConciergeLocale,
  ConciergePlan,
  ConciergePlanPrefill,
} from '../../contracts/concierge.contract.js';
import type { ComboDescription } from './concierge.assistant.js';

/**
 * The assistant's plan: which combo fits what the guest said, and whether the guest asked the
 * assistant to book. Both assistants (rules and model) produce the same shape, so the page can mark
 * a combo "Recommended" and prefill the details form the same way. A plan is advice: the guest
 * checks the stay, ticks the two boxes and presses Send themselves; nothing here prices or books.
 */

/** Said when the guest asks the assistant to book: what was done, and what stays theirs to do. */
export const BOOK_IT_HANDOFF: Record<ConciergeLocale, (comboName: string) => string> = {
  en: (comboName) =>
    `I have put "${comboName}" in your stay and set up a booking card below from what you told me. Please check it, then press "Confirm booking" or reply "confirm". Nothing is booked until you do.`,
  zh: (comboName) =>
    `我已经把「${comboName}」放进你的住宿，并根据你告诉我的信息在下面准备好了预订卡片。请核对，然后点"确认预订"或回复"确认"。在你确认之前不会产生任何预订。`,
};

/**
 * "Book it for me", in either language. The guest is handing the form-filling to the assistant,
 * not the decision: the page still waits for their own Send.
 */
const BOOK_IT =
  /\b(?:book (?:it|this|that|the recommended|the recommendation|for me)|go ahead and book|yes,? book|just book)\b|帮我订|帮我预订|帮我预定|直接订|直接预订|就订这个|就订推荐|订吧|预订吧|预定吧/i;

export const wantsAssistantToBook = (text: string): boolean => BOOK_IT.test(text);

/** The combo the shared fit rule marked, which the server always provides when combos exist. */
export const recommendedCombo = (combos: ComboDescription[]): ComboDescription | null =>
  combos.find((combo) => combo.recommended) ?? combos[0] ?? null;

export interface PlanInput {
  combos: ComboDescription[];
  locale: ConciergeLocale;
  bookRequested: boolean;
  notes: string;
  prefill?: ConciergePlanPrefill | null;
}

/** The plan for needs that are ready to quote; null before that, since nothing can be fitted yet. */
export const buildPlan = (input: PlanInput): ConciergePlan => {
  const combo = recommendedCombo(input.combos);
  return {
    recommendedComboId: combo?.id ?? null,
    reason: combo?.reason ?? null,
    bookRequested: input.bookRequested,
    prefill: input.prefill ?? (input.notes ? { careNotes: input.notes } : null),
  };
};
