import type { ConciergeLocale, ConciergeNeeds } from '../../contracts/concierge.contract.js';
import type {
  AssistantTurnInput,
  AssistantTurnResult,
  ConciergeAssistant,
} from './concierge.assistant.js';
import {
  mergeNeeds,
  missingNeedFields,
  optionalNeedFields,
  type ConciergeNeedsPatch,
} from './concierge.needs.js';
import {
  detectAmbiguousCare,
  extractNeedsPatches,
  pickPetsFromAnswer,
  type AmbiguousCare,
} from './concierge.rules-extract.js';
import {
  CARE_CLARIFY,
  OPTIONAL_SIZE_QUESTION,
  PACKAGES_READY,
  QUESTION_FOR_FIELD,
  RULES_NOT_UNDERSTOOD,
  RULES_NOTED_FOR_TEAM,
  RULES_POLICY_POINTER,
} from './concierge.copy.js';
import {
  BOOK_IT_HANDOFF,
  buildPlan,
  recommendedCombo,
  wantsAssistantToBook,
} from './concierge.plan.js';

/**
 * A model-free assistant: keyword extraction plus the next question.
 *
 * It exists so the concierge works end to end on a laptop with no cloud credentials, and it is
 * what a deployment runs until a model provider (`CONCIERGE_AI_PROVIDER`) is configured. The response says
 * which mode answered (`assistantMode`), so the interface can be honest about it.
 *
 * It never guesses. A detail it cannot place ("one of them needs medication") becomes a question;
 * free text it cannot read but that is clearly about the pet ("she is scared of thunder") is kept
 * in the notes staff will see, and the reply says so rather than pretending to have understood.
 */

/** A plain yes. Chinese has no word boundaries, so the end is checked by what follows instead. */
const AFFIRMATIVE =
  /^\s*(?:yes please|yes|yeah|yep|sure|ok(?:ay)?|please|好的|好|是的|是|可以|要|嗯)(?![a-z0-9])/i;
/** Text that tries to give dates or pets; if nothing was read from it, the parse failed. */
const LOOKS_LIKE_BOOKING_DETAIL = /\d|night|week|dog|cat|pet|pupp|kitt|狗|猫|晚|月|号|日|周/i;
const MAX_NOTES_LENGTH = 500;
/** A question about money or rules; the rules assistant has no answer and must not make one up. */
const POLICY_QUESTION =
  /cancel|refund|fee|charge|deposit|hold|vaccin|medicat|terms|policy|rule|取消|退款|费用|收费|押金|冻结|疫苗|用药|条款|规则/i;

const wordCount = (text: string): number => {
  const cjk = text.match(/[一-鿿]/g)?.length ?? 0;
  const words = text.split(/\s+/).filter((word) => /[a-z]/i.test(word)).length;
  return words + Math.floor(cjk / 2);
};

const appendNote = (notes: string, text: string): string =>
  (notes ? `${notes}\n${text}` : text).slice(0, MAX_NOTES_LENGTH);

const lastAssistantText = (input: AssistantTurnInput): string | undefined =>
  [...input.messages].reverse().find((message) => message.role === 'assistant')?.text;

/**
 * "Yes" right after "Shall I plan a boarding stay for you?" means yes - also when that question
 * followed a "did not quite catch that" or "added to your notes" line in the same reply.
 */
const answersServiceQuestion = (input: AssistantTurnInput, text: string): boolean =>
  input.needs.service === null &&
  (lastAssistantText(input) ?? '').trimEnd().endsWith(QUESTION_FOR_FIELD[input.locale].service) &&
  AFFIRMATIVE.test(text);

/** The "which pet?" question the last reply asked, in either language. */
const pendingClarify = (input: AssistantTurnInput): AmbiguousCare | null => {
  const last = lastAssistantText(input) ?? '';
  const cares: AmbiguousCare[] = ['medication', 'firstTime'];
  return (
    cares.find(
      (care) => last.includes(CARE_CLARIFY.en[care]) || last.includes(CARE_CLARIFY.zh[care]),
    ) ?? null
  );
};

/** "The cat" after "Which pet takes medication?": that pet does, the others do not. */
const answerToClarify = (
  care: AmbiguousCare,
  text: string,
  needs: ConciergeNeeds,
): ConciergeNeedsPatch | null => {
  const picked = pickPetsFromAnswer(text, needs);
  if (picked === null) return null;
  return {
    pets: needs.pets.map((_pet, index) =>
      care === 'medication'
        ? { index, needsMedication: picked.includes(index) }
        : { index, firstTimeBoarding: picked.includes(index) },
    ),
  };
};

const readyReply = (locale: ConciergeLocale, optionalSize: boolean, reason: string): string =>
  optionalSize
    ? `${PACKAGES_READY[locale]} ${reason} ${OPTIONAL_SIZE_QUESTION[locale]}`
    : `${PACKAGES_READY[locale]} ${reason}`;

export class RulesConciergeAssistant implements ConciergeAssistant {
  readonly mode = 'rules' as const;

  async respond(input: AssistantTurnInput): Promise<AssistantTurnResult> {
    const lastUserMessage = [...input.messages].reverse().find((m) => m.role === 'user');
    const text = lastUserMessage?.text ?? '';
    const needsPatches: ConciergeNeedsPatch[] = lastUserMessage
      ? extractNeedsPatches(text, input.needs, input.today, mergeNeeds)
      : [];
    if (lastUserMessage && answersServiceQuestion(input, text)) {
      needsPatches.push({ service: 'boarding' });
    }
    const clarifying = lastUserMessage ? pendingClarify(input) : null;
    const answer = clarifying
      ? answerToClarify(clarifying, text, needsPatches.reduce(mergeNeeds, input.needs))
      : null;
    if (answer) needsPatches.push(answer);

    let updated = needsPatches.reduce(mergeNeeds, input.needs);
    // "One of them needs medication": ask which pet rather than price it on the wrong one.
    const clarify = lastUserMessage
      ? detectAmbiguousCare(text, updated).map((care) => CARE_CLARIFY[input.locale][care])
      : [];

    const understoodNothing =
      lastUserMessage !== undefined && needsPatches.length === 0 && clarify.length === 0;
    // "Book it for me" is an instruction to this page, so it is acted on below, never kept as a
    // note for staff.
    const bookItAsked = lastUserMessage !== undefined && wantsAssistantToBook(text);
    // A fee or terms question is not a care note and gets no guessed answer: the rules are on the
    // page, and only the model-backed assistant may read them out. "Does cancelling a booking
    // cost anything?" still reads the service word, so only concrete details (dates, pets,
    // extras) make a message a booking detail rather than a question.
    const concreteDetail = needsPatches.some(
      (patch) =>
        patch.startDate !== undefined ||
        patch.endDate !== undefined ||
        patch.pets !== undefined ||
        patch.petCount !== undefined ||
        patch.extras !== undefined,
    );
    const asksAboutPolicy =
      lastUserMessage !== undefined &&
      !concreteDetail &&
      clarify.length === 0 &&
      POLICY_QUESTION.test(text);
    const keepAsNote =
      understoodNothing &&
      !bookItAsked &&
      !asksAboutPolicy &&
      !LOOKS_LIKE_BOOKING_DETAIL.test(text) &&
      wordCount(text) >= 3;
    if (keepAsNote) {
      const notesPatch: ConciergeNeedsPatch = { notes: appendNote(updated.notes, text) };
      needsPatches.push(notesPatch);
      updated = mergeNeeds(updated, notesPatch);
    }

    const [nextMissing] = missingNeedFields(updated, input.today);
    const optionalSize = optionalNeedFields(updated).includes('size');
    // With the options ready the reply names the combo that fits; "book it for me" puts that
    // combo in the stay and prefills the form, and the guest still presses Send (the plan
    // carries both).
    const bookRequested = !nextMissing && bookItAsked;
    const combos = nextMissing ? [] : (await input.describeOptions(updated)).combos;
    const plan = nextMissing
      ? null
      : buildPlan({ combos, locale: input.locale, bookRequested, notes: updated.notes });
    const recommended = recommendedCombo(combos);
    if (plan && bookRequested && recommended) {
      return {
        reply: BOOK_IT_HANDOFF[input.locale](recommended.name),
        needsPatches,
        plan,
      };
    }
    const next = nextMissing
      ? QUESTION_FOR_FIELD[input.locale][nextMissing]
      : readyReply(input.locale, optionalSize, plan?.reason ?? '');

    if (asksAboutPolicy) {
      return { reply: `${RULES_POLICY_POINTER[input.locale]} ${next}`, needsPatches };
    }
    if (keepAsNote) {
      return { reply: `${RULES_NOTED_FOR_TEAM[input.locale]} ${next}`, needsPatches, plan };
    }
    if (understoodNothing && !bookRequested) {
      return { reply: `${RULES_NOT_UNDERSTOOD[input.locale]} ${next}`, needsPatches, plan };
    }
    return { reply: [...clarify, next].join(' '), needsPatches, plan };
  }
}
