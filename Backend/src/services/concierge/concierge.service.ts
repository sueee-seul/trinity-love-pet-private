import {
  CONCIERGE_CURRENCY,
  type ConciergeAcceptQuoteResponse,
  type ConciergeChatRequest,
  type ConciergeChatResponse,
  type ConciergeCombo,
  type ConciergeLastStay,
  type ConciergeLocale,
  type ConciergeNeeds,
  type ConciergePlan,
  type ConciergePriceRequest,
  type ConciergePriceResponse,
  type ConciergeQuote,
  type ConciergeRatesResponse,
} from '../../contracts/concierge.contract.js';
import type { BookingServiceRecord } from '../../repositories/petparent.booking.repository.js';
import { AppError } from '../../common/middlewares/error.middleware.js';
import { findFullNights, type StayForCapacity } from '../booking.capacity.js';
import { getServiceCatalog } from '../petparent.booking.js';
import {
  ConciergeAssistantUnavailableError,
  type AssistantTurnInput,
  type AssistantTurnResult,
  type ComboDescription,
  type ConciergeAssistant,
  type StayOptionsView,
} from './concierge.assistant.js';
import { getConciergeAssistant } from './concierge.assistant-factory.js';
import { RulesConciergeAssistant } from './concierge.rules-assistant.js';
import { describeBookingRules } from './concierge.rules-view.js';
import {
  ASSISTANT_UNAVAILABLE,
  FULLY_BOOKED,
  LAST_STAY_COPIED,
  NO_LAST_STAY,
  OPTIONS_UPDATED,
  PACKAGES_READY,
  QUESTION_FOR_FIELD,
  SIGN_IN_FOR_LAST_STAY,
} from './concierge.copy.js';
import { readLastStay, wantsLastStay } from './concierge.last-stay.js';
import {
  createEmptyNeeds,
  createEmptyPet,
  hasBookableDates,
  isReadyToQuote,
  mergeNeeds,
  missingNeedFields,
  todayInNewZealand,
} from './concierge.needs.js';
import {
  buildCombos,
  priceSelection,
  toCatalogueView,
  type UnsignedCombo,
  type UnsignedQuote,
} from './concierge.quotes.js';
import { guardReply } from './concierge.reply-guard.js';
import { translatorOf } from './concierge.translate.js';
import { detectMessageLanguage, isBuiltInLanguage } from '../../common/language/detect.js';
import { localiseReply } from '../../common/language/translate-lines.js';
import {
  signAcceptedQuote,
  signQuote,
  toSignedQuote,
  verifyQuote,
  type SignedQuote,
} from './concierge.tokens.js';

/**
 * One concierge chat turn, end to end.
 *
 * Order matters: the assistant proposes needs patches, the service merges them, and only then does
 * deterministic code decide what is missing and build, price and sign the combos. If the model is
 * down the rules assistant answers the same turn instead, so a guest is never stuck behind an
 * outage; the response says which assistant replied. The unavailable notice is used only when the
 * rules assistant is the configured one and fails too.
 */

export interface ConciergeServiceDependencies {
  assistant?: ConciergeAssistant;
  loadCatalogue?: () => Promise<BookingServiceRecord[]>;
  today?: () => string;
  /** Nights of a planned stay that cannot take its pets; the facility capacity check by default. */
  findFullNights?: (stay: StayForCapacity) => Promise<string[]>;
  /** The fee rules and terms as text, for policy questions; the live terms by default. */
  describeRules?: () => Promise<string>;
  /** Answers the turn when the model fails; the rules assistant by default. */
  fallbackAssistant?: ConciergeAssistant;
  /** The signed-in pet parent, when there is one; "same as last time" needs an account. */
  ownerId?: string | null;
  /** The parent's latest stay; the My stays read by default. */
  readLastStay?: (ownerId: string) => Promise<ConciergeLastStay | null>;
}

const rulesFallback = new RulesConciergeAssistant();

const includesByPet = (quote: UnsignedQuote, petCount: number): string[][] =>
  Array.from({ length: petCount }, (_unused, petIndex) =>
    quote.lines.filter((line) => line.petIndex === petIndex).map((line) => line.name),
  );

const describeCombo = (combo: UnsignedCombo, petCount: number): ComboDescription => ({
  id: combo.id,
  name: combo.quote.name,
  includesByPet: includesByPet(combo.quote, petCount),
  reason: combo.reason,
  recommended: combo.recommended,
});

const serviceNames = (catalogue: BookingServiceRecord[]): StayOptionsView['services'] => {
  const view = toCatalogueView(catalogue);
  return {
    rooms: view.rooms.map((item) => item.name),
    foods: view.foods.map((item) => item.name),
    addons: view.addons.map((item) => item.name),
  };
};

const quotedPets = (needs: ConciergeNeeds): SignedQuote['pets'] =>
  needs.pets.map((pet) => ({
    // Ready-to-quote needs have a species for every pet; `other` only guards the type.
    species: pet.species ?? 'other',
    size: pet.size,
    needsMedication: pet.needsMedication,
    firstTimeBoarding: pet.firstTimeBoarding,
    ...(pet.name ? { name: pet.name } : {}),
  }));

const signUnsignedQuote = async (
  needs: ConciergeNeeds,
  quote: UnsignedQuote,
): Promise<ConciergeQuote> => {
  // `priceSelection` already refused needs without dates; this only narrows the type.
  const startDate = needs.startDate ?? '';
  const endDate = needs.endDate ?? '';
  const { token, expiresAt } = await signQuote(
    toSignedQuote(quote, startDate, endDate, quotedPets(needs)),
  );
  return {
    ...quote,
    currency: CONCIERGE_CURRENCY,
    gstInclusive: true as const,
    quoteToken: token,
    expiresAt,
  };
};

const signCombos = async (
  needs: ConciergeNeeds,
  combos: UnsignedCombo[],
): Promise<ConciergeCombo[]> =>
  Promise.all(
    combos.map(async (combo) => ({
      id: combo.id,
      quote: await signUnsignedQuote(needs, combo.quote),
      reason: combo.reason,
      recommended: combo.recommended,
    })),
  );

/**
 * The assistant's pick wins when it names a combo that exists; otherwise the shared rule's pick
 * stands. Exactly one combo ends up marked, so the page never shows two recommendations.
 */
const applyRecommendation = (
  combos: ConciergeCombo[],
  plan: ConciergePlan | null,
): { combos: ConciergeCombo[]; plan: ConciergePlan | null } => {
  if (combos.length === 0) return { combos, plan: null };
  const chosen = combos.find((combo) => combo.id === plan?.recommendedComboId);
  if (!chosen) {
    const byRule = combos.find((combo) => combo.recommended) ?? combos[0];
    return {
      combos,
      plan: plan
        ? { ...plan, recommendedComboId: byRule?.id ?? null, reason: byRule?.reason ?? null }
        : null,
    };
  }
  return {
    combos: combos.map((combo) => ({
      ...combo,
      recommended: combo.id === chosen.id,
      reason: combo.id === chosen.id && plan?.reason ? plan.reason : combo.reason,
    })),
    plan,
  };
};

const lastUserText = (request: ConciergeChatRequest): string =>
  [...request.messages].reverse().find((message) => message.role === 'user')?.text ?? '';

const petNamesOf = (needs: ConciergeNeeds, locale: ConciergeLocale): string => {
  const names = needs.pets.map((pet, index) => pet.name ?? `Pet ${index + 1}`);
  if (locale === 'zh') return names.join('和');
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
};

interface LastStayTurn {
  reply: string;
  needs: ConciergeNeeds;
  lastStay: ConciergeLastStay | null;
}

/**
 * "Same as last time" is answered by the service, not the assistant: it is a lookup on the
 * parent's own account, and the reply must say exactly what was copied. The pets and extras go
 * into the needs; dates the guest already gave are kept, and otherwise asked for.
 */
const copyLastStay = async (
  request: ConciergeChatRequest,
  today: string,
  dependencies: ConciergeServiceDependencies,
): Promise<LastStayTurn> => {
  const { locale } = request;
  if (!dependencies.ownerId) {
    return { reply: SIGN_IN_FOR_LAST_STAY[locale], needs: request.needs, lastStay: null };
  }
  const lastStay = await (dependencies.readLastStay ?? readLastStay)(dependencies.ownerId);
  if (!lastStay) {
    return { reply: NO_LAST_STAY[locale], needs: request.needs, lastStay: null };
  }
  const needs = mergeNeeds(request.needs, {
    service: 'boarding',
    petCount: lastStay.needs.pets.length,
    pets: lastStay.needs.pets.map((pet, index) => ({ index, ...pet })),
    extras: lastStay.needs.extras,
  });
  const datesStillNeeded = !hasBookableDates(needs, today);
  return {
    reply: LAST_STAY_COPIED[locale](
      petNamesOf(needs, locale),
      lastStay.startDate,
      datesStillNeeded,
    ),
    needs,
    lastStay,
  };
};

/**
 * A tapped answer needs no model: ask for the next missing detail in the same words the rules
 * assistant uses, or say the options are ready (once; later taps just say they were updated).
 */
const fixedReplyAfterChoice = (request: ConciergeChatRequest, today: string): string => {
  const [nextMissing] = missingNeedFields(request.needs, today);
  if (nextMissing) {
    return QUESTION_FOR_FIELD[request.locale][nextMissing];
  }
  const alreadyAnnounced = request.messages.some(
    (message) => message.role === 'assistant' && message.text === PACKAGES_READY[request.locale],
  );
  return alreadyAnnounced ? OPTIONS_UPDATED[request.locale] : PACKAGES_READY[request.locale];
};

export const runConciergeTurn = async (
  request: ConciergeChatRequest,
  dependencies: ConciergeServiceDependencies = {},
): Promise<ConciergeChatResponse> => {
  const assistant = dependencies.assistant ?? getConciergeAssistant();
  const loadCatalogue = dependencies.loadCatalogue ?? getServiceCatalog;
  const today = (dependencies.today ?? todayInNewZealand)();

  let catalogue: BookingServiceRecord[] | null = null;
  const catalogueOnce = async (): Promise<BookingServiceRecord[]> => {
    catalogue ??= await loadCatalogue();
    return catalogue;
  };

  const describeOptions = async (needs: ConciergeNeeds): Promise<StayOptionsView> => {
    const missingFields = missingNeedFields(needs, today);
    const services = serviceNames(await catalogueOnce());
    if (missingFields.length > 0) {
      return { ready: false, missingFields, combos: [], services };
    }
    const combos = buildCombos(needs, await catalogueOnce(), request.locale);
    return {
      ready: true,
      missingFields,
      combos: combos.map((combo) => describeCombo(combo, needs.pets.length)),
      services,
    };
  };

  // The reply follows the language of the guest's last message; cards and page copy stay in the
  // page locale. Hand-written lines are English or Chinese, and for any other language the English
  // line is translated by the assistant's own model just before the reply goes out.
  const replyLanguage = detectMessageLanguage(lastUserText(request), request.locale);
  const replyLocale: ConciergeLocale = isBuiltInLanguage(replyLanguage) ? replyLanguage : 'en';
  const replyRequest: ConciergeChatRequest = { ...request, locale: replyLocale };

  let reply = '';
  let needs = request.needs;
  let assistantAvailable = true;
  let plan: ConciergePlan | null = null;
  let assistantMode = assistant.mode;
  let lastStay: ConciergeLastStay | null = null;
  if (request.trigger === 'choice') {
    reply = fixedReplyAfterChoice(replyRequest, today);
  } else if (request.trigger === 'message' && wantsLastStay(lastUserText(request))) {
    const copied = await copyLastStay(replyRequest, today, dependencies);
    reply = copied.reply;
    needs = copied.needs;
    lastStay = copied.lastStay;
  } else if (request.trigger === 'message') {
    const turn: AssistantTurnInput = {
      messages: request.messages,
      needs: request.needs,
      locale: replyLocale,
      replyLanguage,
      today,
      signedIn: Boolean(dependencies.ownerId),
      describeOptions,
      describeRules: dependencies.describeRules ?? describeBookingRules,
    };
    const fallback = dependencies.fallbackAssistant ?? rulesFallback;
    try {
      let result: AssistantTurnResult;
      try {
        result = await assistant.respond(turn);
      } catch (error: unknown) {
        if (!(error instanceof ConciergeAssistantUnavailableError) || assistant.mode === 'rules') {
          throw error;
        }
        // The model is down (an expired key, a timeout): the rules assistant takes this turn.
        result = await fallback.respond(turn);
        assistantMode = fallback.mode;
      }
      needs = result.needsPatches.reduce(mergeNeeds, request.needs);
      reply = guardReply(result.reply, replyLocale);
      plan = result.plan ?? null;
    } catch (error: unknown) {
      if (!(error instanceof ConciergeAssistantUnavailableError)) {
        throw error;
      }
      assistantAvailable = false;
      reply = ASSISTANT_UNAVAILABLE[replyLocale];
    }
  }

  const readyToQuote = isReadyToQuote(needs, today);
  const fullNights =
    readyToQuote && needs.startDate && needs.endDate
      ? await (dependencies.findFullNights ?? findFullNights)({
          startDate: needs.startDate,
          endDate: needs.endDate,
          petCount: needs.pets.length,
        })
      : [];
  const unsignedCombos =
    readyToQuote && fullNights.length === 0
      ? buildCombos(needs, await catalogueOnce(), request.locale)
      : [];
  // Options that cannot be booked are never shown, so a reply announcing them would be wrong.
  if (fullNights.length > 0 && request.trigger !== 'checklist') {
    reply = FULLY_BOOKED[replyLocale](fullNights);
  }
  reply = await localiseReply(reply, replyLanguage, translatorOf(assistant));
  // A plan points at a combo, so it goes out only with the combos it points at.
  const recommended = applyRecommendation(await signCombos(needs, unsignedCombos), plan);

  return {
    reply,
    needs,
    missingFields: missingNeedFields(needs, today),
    combos: recommended.combos,
    catalogue: toCatalogueView(await catalogueOnce()),
    assistantMode,
    plan: recommended.plan,
    assistantAvailable,
    fullNights,
    lastStay,
  };
};

/** The signed-in parent's latest stay, for the "same as last time" chip. */
export const getConciergeLastStay = async (
  ownerId: string,
  dependencies: Pick<ConciergeServiceDependencies, 'readLastStay'> = {},
): Promise<{ lastStay: ConciergeLastStay | null }> => ({
  lastStay: await (dependencies.readLastStay ?? readLastStay)(ownerId),
});

/**
 * Prices a stay the guest built in the panel; the same rule and signature as a combo.
 *
 * The needs come straight from the browser, and checkout trusts a signed quote's dates, so the same
 * readiness rule the chat applies before quoting is applied here: no stay in the past, no pick-up
 * on or before drop-off, nothing longer than the facility books, and a species for every pet.
 */
export const priceConciergeSelection = async (
  request: ConciergePriceRequest,
  dependencies: Pick<ConciergeServiceDependencies, 'loadCatalogue' | 'today'> = {},
): Promise<ConciergePriceResponse> => {
  const today = (dependencies.today ?? todayInNewZealand)();
  const [missing] = missingNeedFields(request.needs, today);
  if (missing) {
    throw new AppError(
      `This stay cannot be priced: missing or unbookable ${missing}`,
      'CONCIERGE_SELECTION_INVALID',
      422,
    );
  }
  const catalogue = await (dependencies.loadCatalogue ?? getServiceCatalog)();
  const quote = priceSelection(request.needs, request.selection, catalogue);
  return { quote: await signUnsignedQuote(request.needs, quote) };
};

/**
 * "Agree" on a stay. The guest's click is recorded server-side as a signed acceptance with a
 * timestamp; the booking is made when the guest sends their details.
 */
export const acceptConciergeQuote = async (
  quoteToken: string,
  acceptedAt: Date = new Date(),
): Promise<ConciergeAcceptQuoteResponse> => {
  const quote = await verifyQuote(quoteToken);
  const acceptedQuoteToken = await signAcceptedQuote(quote, acceptedAt);
  return {
    acceptedQuoteToken,
    acceptedAt: acceptedAt.toISOString(),
    name: quote.name,
    total: quote.total,
  };
};

const addOneDay = (isoDate: string): string => {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
};

const RATES_LOCALE: ConciergeLocale = 'en';

/**
 * The honest "from" price shown before any question: the cheapest combo for one pet and one
 * night, built by the same rule as a real quote (cheapest room and food, plus anything
 * compulsory). It is a price a guest can actually book, never a bait figure.
 */
export const getConciergeRates = async (
  dependencies: Pick<ConciergeServiceDependencies, 'loadCatalogue' | 'today'> = {},
): Promise<ConciergeRatesResponse> => {
  const catalogue = await (dependencies.loadCatalogue ?? getServiceCatalog)();
  const startDate = (dependencies.today ?? todayInNewZealand)();
  const totals = (['dog', 'cat'] as const).flatMap((species) => {
    const needs: ConciergeNeeds = {
      ...createEmptyNeeds(),
      service: 'boarding',
      startDate,
      endDate: addOneDay(startDate),
      pets: [{ ...createEmptyPet(), species, size: species === 'dog' ? 'small' : null }],
    };
    return buildCombos(needs, catalogue, RATES_LOCALE).map((combo) => combo.quote.total);
  });
  return {
    fromTotal: Math.min(...totals),
    nights: 1,
    currency: CONCIERGE_CURRENCY,
    gstInclusive: true,
  };
};
