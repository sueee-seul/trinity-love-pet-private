/**
 * The two LLM calls behind the pet-parent AI chatbot (see
 * docs/pet-parent-ai-chatbot-architecture.md and the design doc's Section 4):
 *
 *   1. resolveTurn(), the "Context Resolver": classify the message as
 *                          clear / ambiguous / invalid / compare / unsupported,
 *                          and pull out intent (qa vs. new_workflow).
 *   2. generateAnswer(): answer strictly from the retrieved records.
 *
 * A code-level guardrail sits between the two calls: even if the model picks
 * a pet confidently, resolveBooking() decides which booking/stay to use by
 * checking real data and the conversation's stored state, rather than
 * trusting the model to track that itself. This mirrors (and, once this file
 * is relied on, supersedes) the prototype in AiChatbox/resolver.py.
 * AiChatbox/resolver.py is marked NOT CANONICAL for exactly this reason.
 *
 * Both calls write text a pet parent reads, so that text leaves through
 * removeDashes: the prompts ask for plain punctuation, and this makes sure.
 */

import { generateObject, generateText } from 'ai';
import { z } from 'zod';
import { llmProvider, supportsCustomTemperature } from './llm.service.js';
import { removeDashes } from '../common/utils/plain-punctuation.js';
import { CHAT_FORMATTING_RULE } from '../common/language/chat-formatting.js';
import type { StayStatus } from '../contracts/stay-status.contract.js';
import type { ChatbotBookingRow } from '../repositories/petparent.chatbot.repository.js';
import { STAY_STATUS_LABELS, toStayStatus, type ReviewedStay } from './stay-status.js';

export type ConversationActivity =
  | 'feeding'
  | 'medication'
  | 'behavior_and_health'
  | 'special_notes'
  | 'boarding_details'
  | 'services'
  | 'booking_info'
  | 'latest_event'
  | 'next_event';

export const ALL_PETS_QUICK_REPLY = 'All my pets';
export const ALL_STAYS_QUICK_REPLY = 'All stays';

const ALL_PETS_SCOPE_PATTERN =
  /\b(?:all|every)\s+(?:(?:of\s+)?(?:my|our|the)\s+)?pets?\b|\b(?:all|every)\s+(?:the\s+)?(?:pet\s+)?(?:information|info|details|records|care|profile)\b|\ball\s+about\s+(?:(?:my|our|the)\s+)?pets?\b/i;

const ALL_PETS_REQUEST_PATTERN =
  /\b(?:how|what|show|tell|give|list|summari[sz]e|provide|describe|want|need|information|info|details|overview)\b/i;

export const explicitlyRequestsAllPets = (userMessage: string): boolean => {
  const normalizedMessage = userMessage
    .trim()
    .toLowerCase()
    .replace(/[?.!]+$/, '');
  const isDirectAllPetsSelection = /^all(?:\s+of)?\s+(?:(?:my|our|the)\s+)?pets?$/.test(
    normalizedMessage,
  );
  return (
    isDirectAllPetsSelection ||
    (ALL_PETS_SCOPE_PATTERN.test(userMessage) && ALL_PETS_REQUEST_PATTERN.test(userMessage))
  );
};

const BROAD_PETS_QUESTION_PATTERN =
  /\b(?:how\s+are|what\s+about|tell\s+me\s+about)\s+(?:(?:my|our|the)\s+)?pets\b/i;

export const asksBroadlyAboutPets = (userMessage: string): boolean =>
  BROAD_PETS_QUESTION_PATTERN.test(userMessage) && !explicitlyRequestsAllPets(userMessage);

export interface ResolverPet {
  uuid: string;
  name: string;
}

/** One booking, already labelled ("Sep 8-10 (current)") for prompts and hint matching. */
export interface ResolverBooking {
  bookingPetId: string;
  petUuid: string;
  stayLabel: string;
}

const resolverOutputSchema = z
  .object({
    intent: z.enum(['qa', 'new_workflow']),
    outcome: z
      .enum(['clear', 'ambiguous', 'invalid', 'compare', 'unsupported', 'all_pets'])
      .nullable(),
    pet: z.string().nullable(),
    pets_compare: z.array(z.string()).nullable(),
    activity: z
      .enum([
        'feeding',
        'medication',
        'behavior_and_health',
        'special_notes',
        'boarding_details',
        'services',
        'booking_info',
        'latest_event',
        'next_event',
      ])
      .nullable(),
    booking_hint: z.string().nullable(),
    candidates: z.array(z.string()),
    include_all_pets_option: z.boolean(),
    invalid_name: z.string().nullable(),
    message: z.string().nullable(),
  })
  .strict();

export type ResolverOutput = z.infer<typeof resolverOutputSchema>;

const findValidJsonObject = (text: string): string | null => {
  for (let start = 0; start < text.length; start += 1) {
    if (text[start] !== '{') continue;

    let depth = 0;
    let insideString = false;
    let escaped = false;

    for (let end = start; end < text.length; end += 1) {
      const character = text[end];

      if (insideString) {
        if (escaped) {
          escaped = false;
        } else if (character === '\\') {
          escaped = true;
        } else if (character === '"') {
          insideString = false;
        }
        continue;
      }

      if (character === '"') {
        insideString = true;
      } else if (character === '{') {
        depth += 1;
      } else if (character === '}') {
        depth -= 1;
        if (depth === 0) {
          const candidate = text.slice(start, end + 1);
          try {
            const parsed: unknown = JSON.parse(candidate);
            if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
              return candidate;
            }
          } catch {
            break;
          }
        }
      }
    }
  }

  return null;
};

const RESOLVER_SYSTEM_PROMPT = (
  petsBlock: string,
): string => `You are the context resolver for a pet-boarding chatbot.

The signed-in user's actual pets and bookings are:
${petsBlock}

You will be given the running context stack for this conversation and the
user's latest message. Decide how to handle it and respond with ONLY a JSON
object with exactly these fields:

{
  "intent": "qa" | "new_workflow",
  "outcome": "clear" | "ambiguous" | "invalid" | "compare" | "unsupported" | "all_pets" | null,
  "pet": "<pet name or null>",
  "pets_compare": ["<pet name>", ...] or null,
  "activity": "feeding" | "medication" | "behavior_and_health" | "special_notes" | "boarding_details" | "services" | "booking_info" | "latest_event" | "next_event" | null,
  "booking_hint": "<stay/date/booking-id text identifying one booking, or 'all stays' when the user explicitly wants every stay; null if no stay scope was given>",
  "candidates": ["<pet name>", ...],
  "include_all_pets_option": true | false,
  "invalid_name": "<name the user mentioned that is NOT one of their pets, or null>",
  "message": "<clarifying question, decline message, or workflow-switch message, or null>"
}

Rules (this is the actual design spec, so follow it exactly):
- Set "outcome" to "all_pets" only when the user explicitly asks for a
  comprehensive overview or all available information about every pet on
  their account (for example, "tell me all about my pets" or "all pet information"). This
  is not a comparison: leave "pet", "pets_compare", and "activity" null. Do
  not use this for a question about one named pet or a comparison of one topic.
- If the user asks a general question about their pets in plural without
  explicitly asking for all-pet information (for example, "How are my pets?"),
  set "outcome" to "ambiguous" and "include_all_pets_option" to true. Leave
  "activity" and "pet" null so the parent can choose a pet or an all-pets
  overview. For ordinary ambiguity, set "include_all_pets_option" to false.
- If the immediately preceding assistant message offered the exact option
  "${ALL_PETS_QUICK_REPLY}" and the user selects it, classify the turn as
  "all_pets".
- "intent": "new_workflow" ONLY if the user is trying to do something other
  than ask a question about an existing stay, e.g. "I want to make a new
  booking." Everything else is "qa". When intent is "new_workflow", set
  "outcome" to null, leave pet/activity null, and put a short message in
  "message" offering to start a new conversation for that workflow.
- "activity": pick the one the question is actually about:
  - "feeding": their feeding routine/schedule.
  - "medication": medication instructions.
  - "behavior_and_health": temperament, sleep habits, vaccination-adjacent
    health notes, or anything else from the general behavior/health notes.
  - "special_notes": any other special instruction the owner left.
  - "boarding_details": yes/no logistics, such as first-time boarding, crate
    trained, allowed to socialize, fully vaccinated.
  - "services": what's booked: the boarding rate, food arrangement, add-ons.
  - "booking_info": the booking/stay itself (its dates, or whether it's the
    current/upcoming/past stay) rather than any of the above.
  - "next_event": the next scheduled care task or activity today, such as a
    walk, meal, medication, or grooming. Use this for questions asking what
    happens next or what the next event is today.
  - "latest_event": the most recently completed care task or activity recorded
    for the pet, such as a walk, meal, medication, or grooming. Use this for
    questions asking about the latest, most recent, or last completed event.
- If intent is "qa": resolve which pet the question is about.
  - "clear": pet is named explicitly, OR a pronoun/ambiguous reference can be
    resolved unambiguously from the current entity in the context stack
    (only when exactly one pet was the current entity going into this turn).
    If the user's message identifies which stay/booking they mean, put that
    text in "booking_hint" even when it's part of the same sentence.
  - "ambiguous": a pronoun ("he"/"she"/"they"), a vague reference ("the
    other one"), OR a generic possessive that doesn't name a specific pet
    ("my pet", "my dog", "my cat") could plausibly point to more than one
    pet given the recent topics / referenced entities. This includes a
    generic reference on the very first turn, before anything is anchored,
    whenever the user has more than one pet. Do NOT guess. Set "candidates"
    to the plausible pets and put a clarifying question in "message".
  - "invalid": the user names a pet that is not in the pets list above. Put
    that name in "invalid_name" and a polite decline in "message".
  - "compare": the user is asking to compare two or more of their own pets.
    Put the relevant pets in "pets_compare".
  - "unsupported": the message isn't a recognizable pet-care or booking
    question at all: gibberish, abuse, small talk, or anything else
    unrelated to a pet/booking. Leave "pet" null and put a brief, polite
    decline in "message".
- Never guess when uncertain. Prefer "ambiguous" over a wrong guess.
- Write "message" in plain punctuation. Never use em dashes or en dashes.
- Output strictly valid JSON. No trailing commas. No commentary.`;

export const buildPetsBlock = (pets: ResolverPet[], bookings: ResolverBooking[]): string =>
  pets
    .map((pet) => {
      const stays = bookings
        .filter((booking) => booking.petUuid === pet.uuid)
        .map((booking) => booking.stayLabel)
        .join(', ');
      return `- ${pet.name}: bookings = ${stays || '(none)'}`;
    })
    .join('\n');

/** The language the parent reads the chat in. */
export type ChatReplyLanguage = 'en' | 'zh';

/**
 * Added to a prompt when the parent reads Chinese. Names, references and medicines are stored
 * words, so they stay as written; matching against stored data depends on it.
 */
const languageRule = (language: ChatReplyLanguage, shownField: string): string =>
  language === 'zh'
    ? `\nWrite ${shownField} in Simplified Chinese. Keep pet names, people's names, booking references and medicine names exactly as written in the records.`
    : '';

export interface ResolveTurnInput {
  pets: ResolverPet[];
  bookings: ResolverBooking[];
  contextBlock: string;
  currentEntityPet?: ResolverPet | null;
  history: { role: 'user' | 'assistant'; content: string }[];
  userMessage: string;
  replyLanguage?: ChatReplyLanguage;
}

const eventActivityForMessage = (message: string): 'latest_event' | 'next_event' | null => {
  const latest =
    /\b(?:latest|most recent|last)\b.{0,48}\b(?:event|activity|task|update)\b|\b(?:event|activity|task|update)\b.{0,48}\b(?:latest|most recent|last)\b/i;
  const next =
    /\b(?:next|upcoming)\b.{0,48}\b(?:event|activity|task)\b|\b(?:event|activity|task)\b.{0,48}\b(?:next|upcoming)\b|\bwhat happens next\b/i;
  if (latest.test(message)) return 'latest_event';
  if (next.test(message)) return 'next_event';
  return null;
};

export const resolveTurn = async (input: ResolveTurnInput): Promise<ResolverOutput> => {
  const eventActivity = eventActivityForMessage(input.userMessage);
  if (eventActivity) {
    const namedPets = input.pets.filter((pet) => namesPet(pet.name, input.userMessage));
    const currentEntityPet = input.pets.find((pet) => pet.uuid === input.currentEntityPet?.uuid);
    const resolvedPet =
      namedPets.length === 1
        ? namedPets[0]
        : namedPets.length > 1
          ? null
          : (currentEntityPet ?? (input.pets.length === 1 ? input.pets[0] : null));
    const isAmbiguous = !resolvedPet;
    return {
      intent: 'qa',
      outcome: isAmbiguous ? 'ambiguous' : 'clear',
      pet: resolvedPet?.name ?? null,
      pets_compare: null,
      activity: eventActivity,
      booking_hint: null,
      candidates: isAmbiguous ? input.pets.map((pet) => pet.name) : [],
      include_all_pets_option: isAmbiguous && input.pets.length > 1,
      invalid_name: null,
      message: isAmbiguous ? 'Which pet are you asking about?' : null,
    };
  }

  // Only "message" is shown to the parent; every other field is matched against stored data.
  const systemPrompt =
    RESOLVER_SYSTEM_PROMPT(buildPetsBlock(input.pets, input.bookings)) +
    languageRule(input.replyLanguage ?? 'en', 'only the "message" field');
  const contextBlock = `Current context stack:\n${input.contextBlock}\n\nUser's latest message:\n${input.userMessage}`;

  const { object } = await generateObject({
    model: llmProvider,
    system: systemPrompt,
    messages: [...input.history, { role: 'user', content: contextBlock }],
    ...(supportsCustomTemperature() ? { temperature: 0.1 } : {}),
    schema: resolverOutputSchema,
    repairText: async ({ text }) => findValidJsonObject(text),
  });

  // Only "message" is shown to the pet parent. booking_hint and the names are matched against
  // stored data, so they stay exactly as the model wrote them.
  return { ...object, message: object.message === null ? null : removeDashes(object.message) };
};

/* --------------------------------------------------------- guardrail helpers */
/* Ported from AiChatbox/chatbot_harness.py: the model is trusted to classify
   and extract hints, never trusted to make the final pet/booking decision. */

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Exact name match (case-insensitive), not substring: "maxi" must not match "Max". */
export const namesPet = (petName: string, text: string): boolean =>
  new RegExp(`\\b${escapeRegExp(petName.toLowerCase())}\\b`).test(text.toLowerCase());

const GENERIC_PET_REFERENCES = new Set([
  'my pet',
  'my dog',
  'my cat',
  'my animal',
  'the pet',
  'the dog',
  'the cat',
  'the animal',
  'our pet',
  'a pet',
  'that pet',
  'this pet',
]);

/** True if "pet" is a vague phrase the model echoed back rather than an actual name. */
export const isGenericPetReference = (pet: string): boolean =>
  GENERIC_PET_REFERENCES.has(pet.trim().toLowerCase());

const PRONOUNS = /\b(he|him|his|she|her|hers|they|them|their|theirs|it|its)\b/;

/** True if the message uses a 3rd-person pronoun but names no pet at all. */
export const barePronounOnly = (text: string, pets: ResolverPet[]): boolean => {
  const lower = text.toLowerCase();
  if (pets.some((pet) => namesPet(pet.name, lower))) return false;
  return PRONOUNS.test(lower);
};

const formatDate = (date: Date): string =>
  `${date.toLocaleString('en-US', { month: 'short' })} ${date.getDate()}`;

// The resolver prompt and matchBookingHint read "current", "upcoming" and "past" as the parent's
// stays, so only a stay the manager approved gets one of those tags. Any other request carries
// its status words from the parent's pages instead, so a pending, refused or cancelled request is
// never picked as the stay the parent means by "current" or "upcoming".
const STAY_TAGS: Record<StayStatus, string> = {
  staying_now: 'current',
  approved: 'upcoming',
  stay_ended: 'past',
  did_not_arrive: STAY_STATUS_LABELS.did_not_arrive.toLowerCase(),
  waiting_for_review: STAY_STATUS_LABELS.waiting_for_review.toLowerCase(),
  refused: STAY_STATUS_LABELS.refused.toLowerCase(),
  cancelled: STAY_STATUS_LABELS.cancelled.toLowerCase(),
};

/**
 * Ported from AiChatbox/mock_data.py::_stay_label, e.g. "Sep 8-10 (current)" or
 * "Oct 12-16 (waiting for review)". The tag comes from the parent stay status rule.
 */
export const stayLabel = (stay: ReviewedStay, now: Date): string => {
  const start = stay.dropOffTime ?? now;
  const end = stay.pickUpTime ?? start;
  const span =
    start.getMonth() === end.getMonth()
      ? `${formatDate(start)}-${end.getDate()}`
      : `${formatDate(start)} - ${formatDate(end)}`;
  return `${span} (${STAY_TAGS[toStayStatus(stay, now)]})`;
};

/** Loosely match a free-text hint (a date range, 'current'/'upcoming'/'past') against a pet's bookings. */
export const matchBookingHint = (
  bookings: ResolverBooking[],
  hint: string | null,
): ResolverBooking | null => {
  if (!hint) return null;
  const hintLow = hint.toLowerCase();
  for (const booking of bookings) {
    const stayLow = booking.stayLabel.toLowerCase();
    const stayCore = stayLow.split(' (')[0] ?? stayLow;
    if (stayCore && (hintLow.includes(stayCore) || stayLow.includes(hintLow))) return booking;
    if (stayLow.includes('(current)') && hintLow.includes('current')) return booking;
    if (stayLow.includes('(upcoming)') && hintLow.includes('upcoming')) return booking;
    if (stayLow.includes('(past)') && hintLow.includes('past')) return booking;
  }
  return null;
};

export interface ResolveBookingResult {
  bookingPetId: string | null;
  stayLabelText: string | null;
  clarify: string | null;
}

/**
 * Code-level guardrail for booking/stay disambiguation. Priority:
 *   1. An explicit hint in this message that matches one of the pet's bookings.
 *   2. The pet has exactly one booking.
 *   3. Otherwise: don't guess, ask which stay or whether all stays are wanted.
 */
export const resolveBooking = (
  petName: string,
  petBookings: ResolverBooking[],
  bookingHint: string | null,
): ResolveBookingResult => {
  const matched = matchBookingHint(petBookings, bookingHint);
  if (matched)
    return { bookingPetId: matched.bookingPetId, stayLabelText: matched.stayLabel, clarify: null };

  const [only] = petBookings;
  if (petBookings.length === 1 && only) {
    return { bookingPetId: only.bookingPetId, stayLabelText: only.stayLabel, clarify: null };
  }

  const options = petBookings.map((booking) => booking.stayLabel).join(', ');
  return {
    bookingPetId: null,
    stayLabelText: null,
    clarify: `Which stay are you referring to for ${petName}, or would you like information about all stays? ${options}`,
  };
};

export const toResolverBookings = (rows: ChatbotBookingRow[], now: Date): ResolverBooking[] =>
  rows.map((row) => ({
    bookingPetId: row.bookingPetId,
    petUuid: row.petUuid,
    stayLabel: stayLabel(row, now),
  }));

/* ------------------------------------------------------------- answer call */

interface AnswerOptions {
  allPets?: boolean;
  allStays?: boolean;
  replyLanguage?: ChatReplyLanguage;
}

const ANSWER_SYSTEM_PROMPT = (records: unknown, options: AnswerOptions): string => {
  const { allPets = false, allStays = false, replyLanguage = 'en' } = options;
  const responseInstructions = allPets
    ? `Give a compact overview grouped by pet, with each pet's stays grouped beneath it.
Include the profile, care, boarding, and booked-service details present in the records.
Mention missing information briefly. Do not collapse details from different pets or stays.`
    : allStays
      ? "Give a concise overview grouped by stay. Keep each stay's details separate and mention missing information briefly."
      : 'Be warm and concise (one to three sentences). If a record says data is not available, say so plainly.';

  return `You are the pet-boarding chatbot's answer generator.
Answer the user's question using ONLY the retrieved records below. ${responseInstructions}
Never invent details that aren't in the records. ${CHAT_FORMATTING_RULE} Use plain punctuation. Never use em dashes or en dashes.
Call the start and end of a stay check-in and check-out (in Chinese 入住 and 离店), never drop-off or pick-up: the parent brings the pet in and takes it home, Wagstay does not collect pets.${languageRule(replyLanguage, 'your answer')}

Retrieved records:
${JSON.stringify(records)}`;
};

export const generateAnswer = async (
  userMessage: string,
  records: unknown,
  options: AnswerOptions = {},
): Promise<string> => {
  const { text } = await generateText({
    model: llmProvider,
    system: ANSWER_SYSTEM_PROMPT(records, options),
    prompt: userMessage,
    ...(supportsCustomTemperature() ? { temperature: 0.3 } : {}),
  });
  return removeDashes(text);
};
