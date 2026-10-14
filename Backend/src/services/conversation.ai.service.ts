/**
 * Orchestrates one AI turn of the pet-parent chatbot: resolve -> guardrail ->
 * retrieve -> answer. See docs/pet-parent-ai-chatbot-architecture.md for the
 * full request flow this implements, and AiChatbox/chatbot_harness.py's
 * run_turn() for the prototype this ports (against mock data) to real
 * Postgres-backed data.
 *
 * This module only computes what should happen; conversation.service.ts owns
 * persisting the result and publishing the SSE update.
 */

import { createHash } from 'node:crypto';
import {
  listPetsForOwner,
  type BookingPetRecord,
} from '../repositories/petparent.booking.repository.js';
import { findLatestPetTask, findNextPetTaskToday } from '../repositories/task.read.repository.js';
import {
  findChatbotBookingsForPets,
  findChatbotCaringInfo,
  findChatbotServicesForBooking,
  type ChatbotCaringInfoRow,
} from '../repositories/petparent.chatbot.repository.js';
import { findMessagesByConversation } from '../repositories/message.repository.js';
import { STAY_STATUS_LABELS, toStayStatus } from './stay-status.js';
import {
  resolveTurn,
  resolveBooking,
  generateAnswer,
  toResolverBookings,
  namesPet,
  isGenericPetReference,
  barePronounOnly,
  ALL_PETS_QUICK_REPLY,
  ALL_STAYS_QUICK_REPLY,
  asksBroadlyAboutPets,
  explicitlyRequestsAllPets,
  matchBookingHint,
  type ResolverPet,
  type ResolverBooking,
  type ResolverOutput,
  type ConversationActivity,
  type ChatReplyLanguage,
} from './conversation.resolver.js';
import type {
  MessageIntent,
  MessageOutcome,
  PetOverviewCard,
  StayAnswerCache,
  StayClarificationCache,
} from '../models/message.model.js';
import type {
  ConversationCurrentEntity,
  ConversationPending,
  ConversationRecentTopic,
} from '../models/conversation.model.js';

export interface ConversationStateSnapshot {
  current_entity: ConversationCurrentEntity | null;
  pending: ConversationPending;
  referenced_pets_uuids: string[];
  recent_topics: ConversationRecentTopic[];
}

export interface AiTurnResult {
  replyBody: string;
  topic: string | null;
  intent: MessageIntent;
  outcome: MessageOutcome;
  petUuid: string | null;
  bookingPetUuid: string | null;
  comparedPetsUuids: string[] | null;
  resolverMetadata: {
    candidates: string[] | null;
    invalid_name: string | null;
    booking_hint: string | null;
    pet_cards?: PetOverviewCard[] | null;
    stay_answer_cache?: StayAnswerCache | null;
    stay_clarification_cache?: StayClarificationCache | null;
  };
  state: ConversationStateSnapshot;
}

const cloneState = (state: ConversationStateSnapshot): ConversationStateSnapshot => {
  const clonedState = JSON.parse(JSON.stringify(state)) as ConversationStateSnapshot;
  return {
    ...clonedState,
    pending: {
      ...clonedState.pending,
      request_text: clonedState.pending.request_text ?? null,
    },
  };
};

const normalizeRequest = (request: string): string =>
  request.trim().toLowerCase().replace(/\s+/g, ' ');

const requestHash = (request: string): string =>
  createHash('sha256').update(normalizeRequest(request)).digest('hex');

const stableJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, nested]) => `${JSON.stringify(key)}:${stableJson(nested)}`).join(',')}}`;
  }
  return JSON.stringify(value);
};

const recordsHash = (records: unknown): string =>
  createHash('sha256').update(stableJson(records)).digest('hex');

const noteEntity = (state: ConversationStateSnapshot, petUuid: string): void => {
  if (!state.referenced_pets_uuids.includes(petUuid)) {
    state.referenced_pets_uuids.push(petUuid);
  }
};

const noteTopic = (state: ConversationStateSnapshot, petUuid: string, topic: string): void => {
  state.recent_topics.push({ pet_uuid: petUuid, topic });
  state.recent_topics = state.recent_topics.slice(-6);
};

const findPetByName = (pets: ResolverPet[], name: string): ResolverPet | undefined =>
  pets.find((pet) => pet.name.toLowerCase() === name.toLowerCase());

const buildContextBlock = (
  ownerUuid: string,
  state: ConversationStateSnapshot,
  petNameByUuid: Map<string, string>,
  bookings: ResolverBooking[],
): string => {
  const lines: string[] = [
    'Fixed:',
    `  user_id = ${ownerUuid}`,
    '',
    'Referenced entities (this conversation):',
  ];
  if (state.referenced_pets_uuids.length > 0) {
    for (const uuid of state.referenced_pets_uuids) {
      lines.push(`  ${petNameByUuid.get(uuid) ?? uuid} (pet_id = ${uuid})`);
    }
  } else {
    lines.push('  (none yet)');
  }

  lines.push('', 'Current entity (most recently resolved):');
  if (state.current_entity) {
    const currentEntity = state.current_entity;
    const stay = bookings.find(
      (booking) => booking.bookingPetId === currentEntity.booking_pets_uuid,
    )?.stayLabel;
    lines.push(
      `  pet = ${petNameByUuid.get(state.current_entity.pet_uuid) ?? state.current_entity.pet_uuid}`,
    );
    lines.push(`  booking_id = ${state.current_entity.booking_pets_uuid}`);
    lines.push(`  stay = ${stay ?? 'unknown'}`);
  } else {
    lines.push('  (none yet)');
  }

  lines.push('', 'Recent topics:');
  if (state.recent_topics.length > 0) {
    for (const { pet_uuid, topic } of state.recent_topics.slice(-4)) {
      lines.push(`  ${petNameByUuid.get(pet_uuid) ?? pet_uuid} -> ${topic}`);
    }
  } else {
    lines.push('  (none yet)');
  }

  return lines.join('\n');
};

const CARING_INFO_FIELD: Partial<Record<ConversationActivity, keyof ChatbotCaringInfoRow>> = {
  feeding: 'feeding_routine',
  medication: 'medication_instructions',
  behavior_and_health: 'behavior_and_health_notes',
  special_notes: 'other_notes',
};

/** The only data the answer-generation call is allowed to see. Ported from AiChatbox/mock_data.py::retrieve. */
const retrieveRecords = async (
  activity: ConversationActivity,
  bookingPetId: string,
  stayStatus: string | undefined,
  petName: string,
): Promise<Record<string, unknown>> => {
  const caringInfoField = CARING_INFO_FIELD[activity];
  if (caringInfoField) {
    const caringInfo = await findChatbotCaringInfo(bookingPetId);
    const value = caringInfo ? caringInfo[caringInfoField] : null;
    if (value === null || value === undefined) {
      return {
        note: `no ${activity} information has been provided for ${petName} on this booking`,
      };
    }
    return { [caringInfoField]: value };
  }

  if (activity === 'boarding_details') {
    const caringInfo = await findChatbotCaringInfo(bookingPetId);
    if (!caringInfo) {
      return { note: `no boarding details have been provided for ${petName} on this booking` };
    }
    return {
      first_time_boarding: caringInfo.first_time_boarding,
      crate_trained: caringInfo.crate_trained,
      allows_socialization: caringInfo.allows_socialization,
      fully_vaccinated: caringInfo.fully_vaccinated,
    };
  }

  if (activity === 'services') {
    const services = await findChatbotServicesForBooking(bookingPetId);
    const addons = services
      .filter((service) => service.category === 'addon')
      .map((service) => service.name);
    return {
      boarding_rate: services.find((service) => service.category === 'boarding_rate')?.name ?? null,
      food: services.find((service) => service.category === 'food')?.name ?? 'not specified',
      addons: addons.length > 0 ? addons : 'none',
      status: stayStatus ?? null,
    };
  }

  return { note: `no ${activity} records found for ${petName} on this booking` };
};

interface StayRecordSet {
  records: Record<string, unknown>;
  fingerprint: string;
}

const retrieveStayRecordSet = async (
  activity: ConversationActivity,
  petName: string,
  selectedBookings: ResolverBooking[],
  bookingRows: Awaited<ReturnType<typeof findChatbotBookingsForPets>>,
  stayStatusById: ReadonlyMap<string, string>,
): Promise<StayRecordSet> => {
  const bookingRowById = new Map(bookingRows.map((row) => [row.bookingPetId, row]));
  const stayRecords = await Promise.all(
    selectedBookings.map(async (booking) => {
      const bookingRow = bookingRowById.get(booking.bookingPetId);
      // The parent's words for the stay ("Waiting for review"), never the checkout's 'paid'.
      const stayStatus = stayStatusById.get(booking.bookingPetId);
      const details = await retrieveRecords(activity, booking.bookingPetId, stayStatus, petName);
      return {
        booking_pets_uuid: booking.bookingPetId,
        stay: booking.stayLabel,
        drop_off_time: bookingRow?.dropOffTime?.toISOString() ?? null,
        pick_up_time: bookingRow?.pickUpTime?.toISOString() ?? null,
        booking_status: stayStatus ?? null,
        details,
      };
    }),
  );
  const records =
    stayRecords.length === 1 && stayRecords[0]
      ? stayRecords[0].details
      : {
          stays: stayRecords.map((stayRecord) => ({
            stay: stayRecord.stay,
            drop_off_time: stayRecord.drop_off_time,
            pick_up_time: stayRecord.pick_up_time,
            booking_status: stayRecord.booking_status,
            details: stayRecord.details,
          })),
        };

  return {
    records,
    fingerprint: recordsHash({ activity, stays: stayRecords }),
  };
};

const sameStrings = (left: string[], right: string[]): boolean => {
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return (
    sortedLeft.length === sortedRight.length &&
    sortedLeft.every((value, index) => value === sortedRight[index])
  );
};

const STAY_CACHE_ACTIVITIES = new Set<ConversationActivity>([
  'feeding',
  'medication',
  'behavior_and_health',
  'special_notes',
  'boarding_details',
  'services',
]);

const isAllStaysRequest = (message: string, bookingHint: string | null): boolean => {
  const normalizedHint = bookingHint?.trim().toLowerCase() ?? '';
  const normalizedMessage = normalizeRequest(message);
  return (
    normalizedHint === ALL_STAYS_QUICK_REPLY.toLowerCase() ||
    /\b(all|every) (of )?(my )?stays\b/.test(normalizedMessage)
  );
};

const isStaySelectionMessage = (message: string, petBookings: ResolverBooking[]): boolean => {
  const normalizedMessage = message.trim().toLowerCase();
  if (normalizedMessage === ALL_STAYS_QUICK_REPLY.toLowerCase()) return true;
  if (message.includes('?')) return false;
  return matchBookingHint(petBookings, message) !== null;
};

const retrieveAllPetInformation = async (
  ownedPets: BookingPetRecord[],
  bookings: ResolverBooking[],
  bookingRows: Awaited<ReturnType<typeof findChatbotBookingsForPets>>,
  stayStatusById: ReadonlyMap<string, string>,
): Promise<{ records: Record<string, unknown>; petCards: PetOverviewCard[] }> => {
  const bookingRowById = new Map(bookingRows.map((booking) => [booking.bookingPetId, booking]));
  const pets = await Promise.all(
    ownedPets.map(async (pet) => {
      const petBookings = bookings.filter((booking) => booking.petUuid === pet.id);
      const stays = await Promise.all(
        petBookings.map(async (booking) => {
          const [caringInfo, services] = await Promise.all([
            findChatbotCaringInfo(booking.bookingPetId),
            findChatbotServicesForBooking(booking.bookingPetId),
          ]);
          const bookingRow = bookingRowById.get(booking.bookingPetId);

          return {
            stay: booking.stayLabel,
            drop_off_time: bookingRow?.dropOffTime?.toISOString() ?? null,
            pick_up_time: bookingRow?.pickUpTime?.toISOString() ?? null,
            booking_status: stayStatusById.get(booking.bookingPetId) ?? null,
            care_information: caringInfo ?? 'No care information is recorded for this stay.',
            booked_services: services,
          };
        }),
      );

      const petCard: PetOverviewCard = {
        profile: {
          name: pet.name,
          species: pet.species,
          breed: pet.breed ?? null,
          age: pet.age ?? null,
          weight: pet.weight ?? null,
          image_url: pet.imageUrl ?? null,
        },
        stays: stays.map((stay) => ({
          ...stay,
          care_information:
            typeof stay.care_information === 'string' ? null : stay.care_information,
          booked_services: stay.booked_services.map(({ name, category }) => ({ name, category })),
        })),
      };
      return {
        petCard,
        record: {
          profile: petCard.profile,
          stays: stays.length > 0 ? stays : 'No stays are recorded for this pet.',
        },
      };
    }),
  );

  return {
    records: { pets: pets.map((pet) => pet.record) },
    petCards: pets.map((pet) => pet.petCard),
  };
};

const createPetAnswerCard = (pet: BookingPetRecord, answer: string): PetOverviewCard => ({
  profile: {
    name: pet.name,
    species: pet.species,
    breed: pet.breed ?? null,
    age: pet.age ?? null,
    weight: pet.weight ?? null,
    image_url: pet.imageUrl ?? null,
  },
  stays: [],
  answer,
});

type PetEventActivity = Extract<ConversationActivity, 'latest_event' | 'next_event'>;

const taskPhotoUrl = (taskId: string, storedName: string): string =>
  `/tasks/${taskId}/photos/${encodeURIComponent(storedName)}?inline=1`;

const createPetEventAnswer = async (
  pet: ResolverPet,
  ownedPet: BookingPetRecord,
  activity: PetEventActivity,
): Promise<{ replyBody: string; petCard: PetOverviewCard }> => {
  const isLatestEvent = activity === 'latest_event';
  const result = isLatestEvent
    ? await findLatestPetTask(pet.uuid)
    : await findNextPetTaskToday(pet.uuid);
  const event = result.rows[0] as
    | {
        id: string;
        title: string;
        due_datetime: Date | string;
        completed_at?: Date | string | null;
        photos?: Array<{ stored_name: string; name: string | null }>;
      }
    | undefined;
  let eventWhen: string | null = null;

  if (event) {
    if (isLatestEvent && event.completed_at) {
      eventWhen = new Intl.DateTimeFormat('en-NZ', {
        timeZone: 'Pacific/Auckland',
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(event.completed_at));
    } else {
      const scheduledAt = new Date(event.due_datetime);
      const hour = scheduledAt.getUTCHours();
      const minute = scheduledAt.getUTCMinutes();
      const time = `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'pm' : 'am'}`;
      if (!isLatestEvent) {
        eventWhen = time;
      } else {
        const date = new Intl.DateTimeFormat('en-NZ', {
          timeZone: 'UTC',
          day: 'numeric',
          month: 'short',
        }).format(scheduledAt);
        eventWhen = `${date} at ${time}`;
      }
    }
  }

  const replyBody =
    event && eventWhen
      ? isLatestEvent
        ? `${pet.name}'s latest recorded event was ${event.title} on ${eventWhen}.`
        : `${pet.name}'s next event today is ${event.title} at ${eventWhen}.`
      : isLatestEvent
        ? `I don't have a completed event recorded for ${pet.name} yet.`
        : `There are no more scheduled events for ${pet.name} today.`;

  return {
    replyBody,
    petCard: {
      profile: {
        name: ownedPet.name,
        species: ownedPet.species,
        breed: ownedPet.breed ?? null,
        age: ownedPet.age ?? null,
        weight: ownedPet.weight ?? null,
        image_url: ownedPet.imageUrl ?? null,
      },
      stays: [],
      answer: replyBody,
      event_photos: event
        ? (event.photos ?? []).map((photo, index) => ({
            url: taskPhotoUrl(event.id, photo.stored_name),
            alt: `${pet.name}'s ${event.title} photo ${index + 1}`,
          }))
        : [],
    },
  };
};

const UNSUPPORTED_MESSAGE =
  "I can only help with questions about your pet's stay: feeding, medication, behavior/health, " +
  'special notes, boarding details, services, or the booking itself.';

export interface GenerateAiTurnParams {
  ownerUuid: string;
  conversationId: string;
  state: ConversationStateSnapshot;
  userMessage: string;
  /** The language the parent reads the chat in; the model answers in it. */
  replyLanguage?: ChatReplyLanguage;
}

export const generateAiTurn = async (params: GenerateAiTurnParams): Promise<AiTurnResult> => {
  const { ownerUuid, conversationId, userMessage, replyLanguage = 'en' } = params;
  const state = cloneState(params.state);

  const ownedPets = await listPetsForOwner(ownerUuid);
  const pets: ResolverPet[] = ownedPets.map((pet) => ({ uuid: pet.id, name: pet.name }));
  const petNameByUuid = new Map(pets.map((pet) => [pet.uuid, pet.name]));
  const bookingRows = await findChatbotBookingsForPets(pets.map((pet) => pet.uuid));
  const now = new Date();
  const bookings = toResolverBookings(bookingRows, now);
  // The words the parent sees on their pages ("Waiting for review"), never the checkout's 'paid'.
  const stayStatusById = new Map(
    bookingRows.map((row) => [row.bookingPetId, STAY_STATUS_LABELS[toStayStatus(row, now)]]),
  );

  const recentMessages = await findMessagesByConversation(conversationId);
  const history = recentMessages
    .filter((message) => message.sender_role === 'pet_owner' || message.sender_role === 'ai')
    .slice(-6)
    .map((message) => ({
      role: (message.sender_role === 'pet_owner' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: message.body,
    }));

  const pendingPet = pets.find((pet) => pet.uuid === state.pending.pet_uuid);
  const pendingPetBookings = pendingPet
    ? bookings.filter((booking) => booking.petUuid === pendingPet.uuid)
    : [];
  const isPendingStaySelection = Boolean(
    pendingPet &&
    state.pending.request_text &&
    isStaySelectionMessage(userMessage, pendingPetBookings),
  );

  if (!isPendingStaySelection) {
    const repeatedClarification = [...recentMessages].reverse().find((message) => {
      const cache = message.resolver_metadata?.stay_clarification_cache;
      if (
        message.sender_role !== 'ai' ||
        !cache ||
        cache.question_hash !== requestHash(userMessage)
      ) {
        return false;
      }
      const cachePet = pets.find((pet) => pet.uuid === cache.pet_uuid);
      if (!cachePet) return false;
      const cachePetIsCurrent =
        namesPet(cachePet.name, userMessage) ||
        state.current_entity?.pet_uuid === cachePet.uuid ||
        state.pending.pet_uuid === cachePet.uuid;
      if (!cachePetIsCurrent) return false;
      const currentPetBookings = bookings.filter((booking) => booking.petUuid === cache.pet_uuid);
      return (
        sameStrings(
          cache.booking_pets_uuids,
          currentPetBookings.map((booking) => booking.bookingPetId),
        ) &&
        sameStrings(
          cache.stay_labels,
          currentPetBookings.map((booking) => booking.stayLabel),
        )
      );
    });

    const clarificationCache = repeatedClarification?.resolver_metadata?.stay_clarification_cache;
    if (repeatedClarification && clarificationCache) {
      noteEntity(state, clarificationCache.pet_uuid);
      state.pending = {
        pet_uuid: clarificationCache.pet_uuid,
        topic: clarificationCache.activity,
        request_text: userMessage,
      };
      return {
        replyBody: repeatedClarification.body,
        topic: null,
        intent: 'qa',
        outcome: 'ambiguous',
        petUuid: null,
        bookingPetUuid: null,
        comparedPetsUuids: null,
        resolverMetadata: {
          candidates: [...clarificationCache.stay_labels, ALL_STAYS_QUICK_REPLY],
          invalid_name: null,
          booking_hint: null,
          stay_clarification_cache: clarificationCache,
        },
        state,
      };
    }
  }

  const cacheQuestion = isPendingStaySelection
    ? (state.pending.request_text ?? userMessage)
    : userMessage;
  const cacheQuestionHash = requestHash(cacheQuestion);
  const selectedPendingBooking = isPendingStaySelection
    ? matchBookingHint(pendingPetBookings, userMessage)
    : null;
  const expectedCachedBookingIds = isPendingStaySelection
    ? userMessage.trim().toLowerCase() === ALL_STAYS_QUICK_REPLY.toLowerCase()
      ? pendingPetBookings.map((booking) => booking.bookingPetId)
      : selectedPendingBooking
        ? [selectedPendingBooking.bookingPetId]
        : []
    : null;
  const matchingAnswerCaches = recentMessages
    .filter((message) => message.sender_role === 'ai')
    .map((message) => ({ message, cache: message.resolver_metadata?.stay_answer_cache }))
    .filter(
      (entry): entry is { message: (typeof recentMessages)[number]; cache: StayAnswerCache } =>
        Boolean(entry.cache && entry.cache.question_hash === cacheQuestionHash),
    )
    .filter(({ cache }) => {
      if (!STAY_CACHE_ACTIVITIES.has(cache.activity as ConversationActivity)) return false;
      if (isPendingStaySelection && cache.pet_uuid !== pendingPet?.uuid) return false;
      return (
        expectedCachedBookingIds === null ||
        sameStrings(cache.booking_pets_uuids, expectedCachedBookingIds)
      );
    });
  const uniqueCacheScopes = new Set(
    matchingAnswerCaches.map(({ cache }) =>
      JSON.stringify([cache.pet_uuid, cache.booking_pets_uuids, cache.activity]),
    ),
  );

  if (matchingAnswerCaches.length > 0 && uniqueCacheScopes.size === 1) {
    for (const { message, cache } of [...matchingAnswerCaches].reverse()) {
      const cachePet = pets.find((pet) => pet.uuid === cache.pet_uuid);
      const ownedCachePet = ownedPets.find((pet) => pet.id === cache.pet_uuid);
      const cachePetBookings = bookings.filter((booking) => booking.petUuid === cache.pet_uuid);
      const cachedBookingIds = cache.booking_pets_uuids;
      const selectedBookings = cachePetBookings.filter((booking) =>
        cachedBookingIds.includes(booking.bookingPetId),
      );
      const scopeIsCurrent =
        selectedBookings.length === cachedBookingIds.length &&
        (!cache.all_stays ||
          sameStrings(
            cachedBookingIds,
            cachePetBookings.map((booking) => booking.bookingPetId),
          )) &&
        (cache.all_stays ||
          cache.explicit_stay_scope ||
          isPendingStaySelection ||
          cachePetBookings.length === 1);
      if (!cachePet || !ownedCachePet || !scopeIsCurrent) continue;

      const records = await retrieveStayRecordSet(
        cache.activity as ConversationActivity,
        cachePet.name,
        selectedBookings,
        bookingRows,
        stayStatusById,
      );
      if (records.fingerprint !== cache.records_hash) continue;

      state.pending = { pet_uuid: null, topic: null, request_text: null };
      if (selectedBookings.length === 1 && selectedBookings[0]) {
        state.current_entity = {
          pet_uuid: cachePet.uuid,
          booking_pets_uuid: selectedBookings[0].bookingPetId,
        };
      }
      noteEntity(state, cachePet.uuid);
      noteTopic(state, cachePet.uuid, cache.activity);
      return {
        replyBody: message.body,
        topic: cache.activity,
        intent: 'qa',
        outcome: 'clear',
        petUuid: cachePet.uuid,
        bookingPetUuid:
          selectedBookings.length === 1 ? (selectedBookings[0]?.bookingPetId ?? null) : null,
        comparedPetsUuids: null,
        resolverMetadata: {
          candidates: null,
          invalid_name: null,
          booking_hint: null,
          pet_cards: [createPetAnswerCard(ownedCachePet, message.body)],
          stay_answer_cache: cache,
        },
        state,
      };
    }
  }

  const contextBlock = buildContextBlock(ownerUuid, state, petNameByUuid, bookings);
  const asksBroadPluralQuestion = asksBroadlyAboutPets(userMessage);
  const selectedAllPetsOption =
    userMessage.trim().toLowerCase() === ALL_PETS_QUICK_REPLY.toLowerCase();
  const selectedAllStaysOption =
    pendingPet !== undefined &&
    userMessage.trim().toLowerCase() === ALL_STAYS_QUICK_REPLY.toLowerCase();
  let resolution: ResolverOutput;
  if (selectedAllPetsOption) {
    resolution = {
      intent: 'qa' as const,
      outcome: 'all_pets' as const,
      pet: null,
      pets_compare: null,
      activity: null,
      booking_hint: null,
      candidates: [],
      include_all_pets_option: false,
      invalid_name: null,
      message: null,
    };
  } else if (selectedAllStaysOption && pendingPet) {
    resolution = {
      intent: 'qa',
      outcome: 'clear',
      pet: pendingPet.name,
      pets_compare: null,
      activity: state.pending.topic as ConversationActivity | null,
      booking_hint: ALL_STAYS_QUICK_REPLY,
      candidates: [],
      include_all_pets_option: false,
      invalid_name: null,
      message: null,
    };
  } else {
    const modelResolution = await resolveTurn({
      pets,
      bookings,
      contextBlock,
      currentEntityPet: state.current_entity
        ? (pets.find((pet) => pet.uuid === state.current_entity?.pet_uuid) ?? null)
        : null,
      history,
      userMessage,
      replyLanguage,
    });
    resolution = asksBroadPluralQuestion
      ? {
          ...modelResolution,
          intent: 'qa',
          outcome: 'ambiguous',
          pet: null,
          pets_compare: null,
          activity: null,
          candidates: pets.map((pet) => pet.name),
          include_all_pets_option: true,
          message: null,
        }
      : modelResolution.outcome === 'all_pets' && !explicitlyRequestsAllPets(userMessage)
        ? { ...modelResolution, outcome: 'ambiguous', include_all_pets_option: true, message: null }
        : modelResolution;
  }

  const noStateChangeResult = (
    replyBody: string,
    outcome: MessageOutcome,
    resolverMetadata: AiTurnResult['resolverMetadata'],
  ): AiTurnResult => ({
    replyBody,
    topic: null,
    intent: resolution.intent,
    outcome,
    petUuid: null,
    bookingPetUuid: null,
    comparedPetsUuids: null,
    resolverMetadata,
    state,
  });

  // --- Section 3g: a workflow switch is a hard boundary, handled first ---
  if (resolution.intent === 'new_workflow') {
    const message = resolution.message ?? "Sure! Let's start a new conversation for that.";
    // Schema has no outcome value for "workflow switch". `intent` already
    // carries that signal, so `outcome` is a placeholder here, same as the
    // hardcoded default message.repository.ts already uses for the pet
    // owner's own (unresolved) message.
    return noStateChangeResult(message, 'clear', {
      candidates: null,
      invalid_name: null,
      booking_hint: null,
    });
  }

  if (resolution.outcome === 'all_pets') {
    const pendingEventActivity = selectedAllPetsOption
      ? (state.pending.topic as ConversationActivity | null)
      : null;
    if (pendingEventActivity === 'next_event' || pendingEventActivity === 'latest_event') {
      const answers = await Promise.all(
        ownedPets.map(async (ownedPet) =>
          createPetEventAnswer(
            { uuid: ownedPet.id, name: ownedPet.name },
            ownedPet,
            pendingEventActivity,
          ),
        ),
      );
      state.pending = { pet_uuid: null, topic: null, request_text: null };
      for (const pet of pets) noteEntity(state, pet.uuid);

      return {
        replyBody: answers.map(({ replyBody }) => replyBody).join('\n'),
        topic: pendingEventActivity,
        intent: 'qa',
        outcome: 'clear',
        petUuid: null,
        bookingPetUuid: null,
        comparedPetsUuids: null,
        resolverMetadata: {
          candidates: null,
          invalid_name: null,
          booking_hint: null,
          pet_cards: answers.map(({ petCard }) => petCard),
        },
        state,
      };
    }

    const { records, petCards } = await retrieveAllPetInformation(
      ownedPets,
      bookings,
      bookingRows,
      stayStatusById,
    );
    const replyBody = await generateAnswer(userMessage, records, { allPets: true, replyLanguage });
    state.pending = { pet_uuid: null, topic: null, request_text: null };
    for (const pet of pets) noteEntity(state, pet.uuid);

    return {
      replyBody,
      topic: 'pet_overview',
      intent: resolution.intent,
      outcome: 'clear',
      petUuid: null,
      bookingPetUuid: null,
      comparedPetsUuids: null,
      resolverMetadata: {
        candidates: null,
        invalid_name: null,
        booking_hint: null,
        pet_cards: petCards,
      },
      state,
    };
  }

  if (resolution.outcome === 'ambiguous') {
    if (asksBroadPluralQuestion)
      state.pending = { pet_uuid: null, topic: null, request_text: null };
    if (resolution.activity) {
      state.pending.topic = resolution.activity;
    }
    const includeAllPetsOption = resolution.include_all_pets_option || pets.length > 1;
    const candidates = pets.map((pet) => pet.name);
    if (includeAllPetsOption) candidates.push(ALL_PETS_QUICK_REPLY);
    const message = includeAllPetsOption
      ? 'Would you like information about a specific pet, or an overview of all your pets?'
      : 'Which pet are you asking about?';
    return noStateChangeResult(message, 'ambiguous', {
      candidates: candidates.length > 0 ? candidates : null,
      invalid_name: null,
      booking_hint: null,
    });
  }

  if (resolution.outcome === 'invalid') {
    const message =
      resolution.message ??
      `I don't have a pet named ${resolution.invalid_name} associated with your account.`;
    return noStateChangeResult(message, 'invalid', {
      candidates: null,
      invalid_name: resolution.invalid_name,
      booking_hint: null,
    });
  }

  if (resolution.outcome === 'unsupported' || resolution.outcome === null) {
    const message = resolution.message ?? UNSUPPORTED_MESSAGE;
    return noStateChangeResult(message, 'unsupported', {
      candidates: null,
      invalid_name: null,
      booking_hint: null,
    });
  }

  if (resolution.outcome === 'compare') {
    const activity: ConversationActivity = resolution.activity ?? 'feeding';
    const records: Record<string, unknown> = {};
    const comparedPetUuids: string[] = [];

    for (const name of resolution.pets_compare ?? []) {
      const pet = findPetByName(pets, name);
      if (!pet) continue;

      const petBookings = bookings.filter((booking) => booking.petUuid === pet.uuid);
      const { bookingPetId, clarify } = resolveBooking(
        pet.name,
        petBookings,
        resolution.booking_hint,
      );
      if (clarify || !bookingPetId) {
        return noStateChangeResult(
          clarify ?? `Which stay are you referring to for ${pet.name}?`,
          'ambiguous',
          {
            candidates:
              petBookings.length > 1 ? petBookings.map((booking) => booking.stayLabel) : null,
            invalid_name: null,
            booking_hint: resolution.booking_hint,
          },
        );
      }

      records[pet.name] = await retrieveRecords(
        activity,
        bookingPetId,
        stayStatusById.get(bookingPetId),
        pet.name,
      );
      noteEntity(state, pet.uuid);
      noteTopic(state, pet.uuid, activity);
      comparedPetUuids.push(pet.uuid);
    }

    const replyBody = await generateAnswer(userMessage, records, { replyLanguage });
    return {
      replyBody,
      topic: activity,
      intent: 'qa',
      outcome: 'compare',
      petUuid: null,
      bookingPetUuid: null,
      comparedPetsUuids: comparedPetUuids.length > 0 ? comparedPetUuids : null,
      resolverMetadata: {
        candidates: null,
        invalid_name: null,
        booking_hint: resolution.booking_hint,
      },
      state,
    };
  }

  // --- outcome === 'clear' ---
  let petName = resolution.pet;

  // Guardrail: a vague phrase echoed back as "pet" is not a name attempt.
  if (petName && isGenericPetReference(petName)) {
    petName = null;
  }

  const usesGenericPetReference = /\b(?:my|our|the|a)\s+(?:pet|dog|cat|animal)\b/i.test(
    userMessage,
  );
  if (usesGenericPetReference && pets.length > 1) {
    const referencedPets = pets.filter((candidate) =>
      state.referenced_pets_uuids.includes(candidate.uuid),
    );
    petName = referencedPets.length === 1 ? (referencedPets[0]?.name ?? null) : null;
  }

  // Guardrail: don't trust the model's pet pick just because it said "clear".
  // It's only justified if the pet was actually named this turn, inherited
  // from the anchored current entity, or inherited from a pet already
  // confirmed earlier this turn (pending).
  const currentPetName = state.current_entity
    ? petNameByUuid.get(state.current_entity.pet_uuid)
    : undefined;
  const pendingPetName = state.pending.pet_uuid
    ? petNameByUuid.get(state.pending.pet_uuid)
    : undefined;
  if (
    petName &&
    !namesPet(petName, userMessage) &&
    petName.toLowerCase() !== currentPetName?.toLowerCase() &&
    petName.toLowerCase() !== pendingPetName?.toLowerCase() &&
    pets.length > 1
  ) {
    petName = null;
  }

  if (!petName) {
    const message = 'Which pet are you asking about?';
    return noStateChangeResult(message, 'ambiguous', {
      candidates: pets.map((pet) => pet.name),
      invalid_name: null,
      booking_hint: null,
    });
  }

  const pet = findPetByName(pets, petName);
  if (!pet) {
    const message = `I don't have a pet named ${petName} associated with your account.`;
    return noStateChangeResult(message, 'invalid', {
      candidates: null,
      invalid_name: petName,
      booking_hint: null,
    });
  }

  // Guardrail (Section 3b): a bare pronoun is only safe to resolve via
  // inheritance when just one pet has ever been referenced this conversation.
  if (barePronounOnly(userMessage, pets) && state.referenced_pets_uuids.length > 1) {
    const candidates = pets.map((ownedPet) => ownedPet.name);
    return noStateChangeResult('Which pet are you asking about?', 'ambiguous', {
      candidates: candidates.length > 0 ? candidates : null,
      invalid_name: null,
      booking_hint: null,
    });
  }

  let activity: ConversationActivity | null = resolution.activity;
  if (!activity && state.pending.pet_uuid === pet.uuid) {
    activity = state.pending.topic as ConversationActivity | null;
  }
  const resolvedActivity: ConversationActivity = activity ?? 'feeding';
  const petBookings = bookings.filter((booking) => booking.petUuid === pet.uuid);
  const pendingStaySelection =
    state.pending.pet_uuid === pet.uuid && isStaySelectionMessage(userMessage, petBookings);
  const questionText = pendingStaySelection
    ? (state.pending.request_text ?? userMessage)
    : userMessage;
  state.pending = { pet_uuid: pet.uuid, topic: resolvedActivity, request_text: questionText };
  noteEntity(state, pet.uuid);

  if (resolvedActivity === 'next_event' || resolvedActivity === 'latest_event') {
    const ownedPet = ownedPets.find((ownedPet) => ownedPet.id === pet.uuid);
    const { replyBody, petCard } = ownedPet
      ? await createPetEventAnswer(pet, ownedPet, resolvedActivity)
      : {
          replyBody: `I couldn't find a pet profile for ${pet.name}.`,
          petCard: null,
        };
    state.pending = { pet_uuid: null, topic: null, request_text: null };
    noteTopic(state, pet.uuid, resolvedActivity);
    return {
      replyBody,
      topic: resolvedActivity,
      intent: 'qa',
      outcome: 'clear',
      petUuid: pet.uuid,
      bookingPetUuid: null,
      comparedPetsUuids: null,
      resolverMetadata: {
        candidates: null,
        invalid_name: null,
        booking_hint: null,
        pet_cards: petCard ? [petCard] : [],
      },
      state,
    };
  }

  const allStaysRequested = isAllStaysRequest(userMessage, resolution.booking_hint);
  if (allStaysRequested) {
    const stayRecordSet = await retrieveStayRecordSet(
      resolvedActivity,
      pet.name,
      petBookings,
      bookingRows,
      stayStatusById,
    );
    let replyBody: string;
    let stayAnswerCache: StayAnswerCache | null = null;
    if (resolvedActivity === 'booking_info') {
      replyBody = petBookings
        .map(
          (booking) =>
            `${pet.name}'s booking id is ${booking.bookingPetId}, for ${booking.stayLabel}.`,
        )
        .join('\n');
    } else {
      replyBody = await generateAnswer(questionText, stayRecordSet.records, {
        allStays: true,
        replyLanguage,
      });
      stayAnswerCache = {
        question_hash: requestHash(questionText),
        pet_uuid: pet.uuid,
        booking_pets_uuids: petBookings.map((booking) => booking.bookingPetId),
        activity: resolvedActivity,
        all_stays: true,
        explicit_stay_scope: true,
        records_hash: stayRecordSet.fingerprint,
      };
    }

    state.pending = { pet_uuid: null, topic: null, request_text: null };
    noteTopic(state, pet.uuid, resolvedActivity);
    return {
      replyBody,
      topic: resolvedActivity,
      intent: 'qa',
      outcome: 'clear',
      petUuid: pet.uuid,
      bookingPetUuid: null,
      comparedPetsUuids: null,
      resolverMetadata: {
        candidates: null,
        invalid_name: null,
        booking_hint: resolution.booking_hint,
        pet_cards: ownedPets
          .filter((ownedPet) => ownedPet.id === pet.uuid)
          .map((ownedPet) => createPetAnswerCard(ownedPet, replyBody)),
        stay_answer_cache: stayAnswerCache,
      },
      state,
    };
  }

  const { bookingPetId, stayLabelText, clarify } = resolveBooking(
    pet.name,
    petBookings,
    resolution.booking_hint,
  );

  if (clarify || !bookingPetId) {
    // pending stays set so a short follow-up reply ("Max", "current stay")
    // inherits the pet/activity already confirmed this turn.
    const stayLabels = petBookings.map((booking) => booking.stayLabel);
    state.pending.request_text = questionText;
    return noStateChangeResult(
      clarify ?? `Which stay are you referring to for ${pet.name}?`,
      'ambiguous',
      {
        candidates: petBookings.length > 1 ? [...stayLabels, ALL_STAYS_QUICK_REPLY] : null,
        invalid_name: null,
        booking_hint: resolution.booking_hint,
        stay_clarification_cache:
          petBookings.length > 1
            ? {
                question_hash: requestHash(questionText),
                pet_uuid: pet.uuid,
                activity: resolvedActivity,
                booking_pets_uuids: petBookings.map((booking) => booking.bookingPetId),
                stay_labels: stayLabels,
              }
            : null,
      },
    );
  }

  state.pending = { pet_uuid: null, topic: null, request_text: null };

  let replyBody: string;
  let stayAnswerCache: StayAnswerCache | null = null;
  let petCards: PetOverviewCard[];
  if (resolvedActivity === 'booking_info') {
    const selectedStayLabel = stayLabelText ?? 'an unlabelled stay';
    const ownedPet = ownedPets.find((ownedPet) => ownedPet.id === pet.uuid);
    replyBody = `${pet.name}'s booking id is ${bookingPetId}, for the stay ${selectedStayLabel}.`;
    const bookingRow = bookingRows.find((row) => row.bookingPetId === bookingPetId);
    const [careInformation, services] = await Promise.all([
      findChatbotCaringInfo(bookingPetId),
      findChatbotServicesForBooking(bookingPetId),
    ]);
    petCards = ownedPet
      ? [
          {
            profile: {
              name: ownedPet.name,
              species: ownedPet.species,
              breed: ownedPet.breed ?? null,
              age: ownedPet.age ?? null,
              weight: ownedPet.weight ?? null,
              image_url: ownedPet.imageUrl ?? null,
            },
            stays: [
              {
                stay: selectedStayLabel,
                drop_off_time: bookingRow?.dropOffTime?.toISOString() ?? null,
                pick_up_time: bookingRow?.pickUpTime?.toISOString() ?? null,
                booking_status: stayStatusById.get(bookingPetId) ?? null,
                care_information: careInformation ?? null,
                booked_services: services.map(({ name, category }) => ({ name, category })),
              },
            ],
            answer: replyBody,
          },
        ]
      : [];
  } else {
    const stayRecordSet = await retrieveStayRecordSet(
      resolvedActivity,
      pet.name,
      petBookings.filter((booking) => booking.bookingPetId === bookingPetId),
      bookingRows,
      stayStatusById,
    );
    replyBody = await generateAnswer(questionText, stayRecordSet.records, { replyLanguage });
    stayAnswerCache = {
      question_hash: requestHash(questionText),
      pet_uuid: pet.uuid,
      booking_pets_uuids: [bookingPetId],
      activity: resolvedActivity,
      all_stays: false,
      explicit_stay_scope:
        pendingStaySelection || matchBookingHint(petBookings, resolution.booking_hint) !== null,
      records_hash: stayRecordSet.fingerprint,
    };
    petCards = ownedPets
      .filter((ownedPet) => ownedPet.id === pet.uuid)
      .map((ownedPet) => createPetAnswerCard(ownedPet, replyBody));
  }

  state.current_entity = { pet_uuid: pet.uuid, booking_pets_uuid: bookingPetId };
  noteTopic(state, pet.uuid, resolvedActivity);

  return {
    replyBody,
    topic: resolvedActivity,
    intent: 'qa',
    outcome: 'clear',
    petUuid: pet.uuid,
    bookingPetUuid: bookingPetId,
    comparedPetsUuids: null,
    resolverMetadata: {
      candidates: null,
      invalid_name: null,
      booking_hint: resolution.booking_hint,
      pet_cards: petCards,
      stay_answer_cache: stayAnswerCache,
    },
    state,
  };
};

export type { ResolverOutput };
