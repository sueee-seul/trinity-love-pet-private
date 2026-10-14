import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// See conversation.resolver.test.ts: stayLabel (used by resolveBooking's
// hint matching and the booking_info shortcut below) formats in local time.
process.env.TZ = 'UTC';

import {
  generateAiTurn,
  type ConversationStateSnapshot,
} from '../services/conversation.ai.service.js';
import {
  resolveTurn,
  generateAnswer,
  type ResolverOutput,
} from '../services/conversation.resolver.js';
import { listPetsForOwner } from '../repositories/petparent.booking.repository.js';
import {
  findChatbotBookingsForPets,
  findChatbotCaringInfo,
  findChatbotServicesForBooking,
  type ChatbotCaringInfoRow,
} from '../repositories/petparent.chatbot.repository.js';
import { findMessagesByConversation } from '../repositories/message.repository.js';

// The guardrails in conversation.resolver.js are real code, not something to
// fake out. Only the two LLM calls (resolveTurn / generateAnswer) are
// mocked. This is what actually exercises the guardrail logic ported from
// AiChatbox/chatbot_harness.py, the same way conversation.ai.service.ts
// composes them for real.
vi.mock('../services/conversation.resolver.js', async () => {
  const actual = await vi.importActual<typeof import('../services/conversation.resolver.js')>(
    '../services/conversation.resolver.js',
  );
  return { ...actual, resolveTurn: vi.fn(), generateAnswer: vi.fn() };
});

vi.mock('../repositories/petparent.booking.repository.js', () => ({
  listPetsForOwner: vi.fn(),
}));

vi.mock('../repositories/petparent.chatbot.repository.js', () => ({
  findChatbotBookingsForPets: vi.fn(),
  findChatbotCaringInfo: vi.fn(),
  findChatbotServicesForBooking: vi.fn(),
}));

vi.mock('../repositories/message.repository.js', () => ({
  findMessagesByConversation: vi.fn(),
}));

const BISCUIT = { uuid: 'pet-biscuit', name: 'Biscuit' };
const SATO = { uuid: 'pet-sato', name: 'Sato' };

const ownedPetsFixture = [
  { id: BISCUIT.uuid, name: BISCUIT.name, species: 'dog' as const },
  { id: SATO.uuid, name: SATO.name, species: 'cat' as const },
];

const bookingRowsFixture = [
  {
    bookingPetId: 'booking-biscuit-current',
    petUuid: BISCUIT.uuid,
    dropOffTime: new Date('2026-09-08T12:00:00Z'),
    pickUpTime: new Date('2026-09-10T12:00:00Z'),
    reviewStatus: 'approved',
  },
  {
    bookingPetId: 'booking-biscuit-upcoming',
    petUuid: BISCUIT.uuid,
    dropOffTime: new Date('2026-12-10T12:00:00Z'),
    pickUpTime: new Date('2026-12-15T12:00:00Z'),
    reviewStatus: 'pending',
  },
  {
    bookingPetId: 'booking-sato-current',
    petUuid: SATO.uuid,
    dropOffTime: new Date('2026-09-08T12:00:00Z'),
    pickUpTime: new Date('2026-09-10T12:00:00Z'),
    reviewStatus: 'approved',
  },
];

const emptyState = (): ConversationStateSnapshot => ({
  current_entity: null,
  pending: { pet_uuid: null, topic: null, request_text: null },
  referenced_pets_uuids: [],
  recent_topics: [],
});

const baseResolverOutput = (overrides: Partial<ResolverOutput>): ResolverOutput => ({
  intent: 'qa',
  outcome: 'clear',
  pet: null,
  pets_compare: null,
  activity: null,
  booking_hint: null,
  candidates: [],
  include_all_pets_option: false,
  invalid_name: null,
  message: null,
  ...overrides,
});

const emptyCaringInfo: ChatbotCaringInfoRow = {
  feeding_routine: null,
  medication_instructions: null,
  first_time_boarding: null,
  crate_trained: null,
  other_notes: null,
  allows_socialization: null,
  fully_vaccinated: null,
  behavior_and_health_notes: null,
};

const runTurn = (
  userMessage: string,
  state: ConversationStateSnapshot = emptyState(),
): ReturnType<typeof generateAiTurn> =>
  generateAiTurn({ ownerUuid: 'owner-1', conversationId: 'conv-1', state, userMessage });

describe('generateAiTurn', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-09T12:00:00Z'));

    vi.mocked(listPetsForOwner).mockResolvedValue(ownedPetsFixture as never);
    vi.mocked(findChatbotBookingsForPets).mockResolvedValue(bookingRowsFixture as never);
    vi.mocked(findMessagesByConversation).mockResolvedValue([] as never);
    vi.mocked(findChatbotCaringInfo).mockReset().mockResolvedValue(null);
    vi.mocked(findChatbotServicesForBooking).mockReset().mockResolvedValue([]);
    vi.mocked(resolveTurn).mockReset();
    vi.mocked(generateAnswer).mockReset().mockResolvedValue('AI answer');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('treats a workflow switch as a hard boundary and leaves state untouched', async () => {
    vi.mocked(resolveTurn).mockResolvedValue(
      baseResolverOutput({
        intent: 'new_workflow',
        outcome: null,
        message: "Sure! Let's start a new conversation for that.",
      }),
    );

    const state = emptyState();
    const result = await runTurn('I want to make a new booking.', state);

    expect(result.intent).toBe('new_workflow');
    expect(result.replyBody).toBe("Sure! Let's start a new conversation for that.");
    expect(result.state).toEqual(state);
    expect(generateAnswer).not.toHaveBeenCalled();
  });

  it('asks rather than guessing on a generic reference with more than one pet', async () => {
    vi.mocked(listPetsForOwner).mockResolvedValue([
      ...ownedPetsFixture,
      { id: 'pet-mochi', name: 'Mochi', species: 'dog' as const },
    ] as never);
    vi.mocked(resolveTurn).mockResolvedValue(
      baseResolverOutput({
        outcome: 'ambiguous',
        activity: 'feeding',
        include_all_pets_option: false,
        candidates: ['Biscuit'],
        message: 'Do you mean Biscuit or Sato?',
      }),
    );

    const result = await runTurn("What's my pet's feeding routine?");

    expect(result.outcome).toBe('ambiguous');
    expect(result.replyBody).toContain('specific pet, or an overview of all your pets');
    expect(result.resolverMetadata.candidates).toEqual(['Biscuit', 'Sato', 'Mochi', 'All my pets']);
    expect(result.state.pending.topic).toBe('feeding');
    expect(result.state.current_entity).toBeNull();
  });

  it('offers an all-pets choice for a broad question about the pets', async () => {
    vi.mocked(resolveTurn).mockResolvedValue(baseResolverOutput({ outcome: 'all_pets' }));

    const result = await runTurn('How are my pets?');

    expect(result.outcome).toBe('ambiguous');
    expect(result.replyBody).toContain('specific pet, or an overview of all your pets');
    expect(result.resolverMetadata.candidates).toEqual(['Biscuit', 'Sato', 'All my pets']);
    expect(generateAnswer).not.toHaveBeenCalled();
  });

  it('offers All my pets for the generic pet-status starter when the owner has multiple pets', async () => {
    vi.mocked(resolveTurn).mockResolvedValue(
      baseResolverOutput({
        outcome: 'ambiguous',
        include_all_pets_option: false,
        candidates: ['Biscuit', 'Sato'],
      }),
    );

    const result = await runTurn('Check my pet status.');

    expect(result.outcome).toBe('ambiguous');
    expect(result.replyBody).toContain('specific pet, or an overview of all your pets');
    expect(result.resolverMetadata.candidates).toEqual(['Biscuit', 'Sato', 'All my pets']);
    expect(generateAnswer).not.toHaveBeenCalled();
  });

  it('passes the selected conversation pet to event-question resolution', async () => {
    vi.mocked(resolveTurn).mockResolvedValue(
      baseResolverOutput({
        outcome: 'ambiguous',
        activity: 'latest_event',
        candidates: ['Biscuit', 'Sato'],
        include_all_pets_option: true,
      }),
    );

    await runTurn('What is the latest event?', {
      ...emptyState(),
      current_entity: {
        pet_uuid: BISCUIT.uuid,
        booking_pets_uuid: 'booking-biscuit-current',
      },
      referenced_pets_uuids: [BISCUIT.uuid],
    });

    expect(resolveTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        currentEntityPet: { uuid: BISCUIT.uuid, name: BISCUIT.name },
      }),
    );
  });

  it('declines a pet name that is not on the account', async () => {
    vi.mocked(resolveTurn).mockResolvedValue(
      baseResolverOutput({ outcome: 'invalid', invalid_name: 'Whiskers' }),
    );

    const result = await runTurn('How is Whiskers doing?');

    expect(result.outcome).toBe('invalid');
    expect(result.replyBody).toBe(
      "I don't have a pet named Whiskers associated with your account.",
    );
    expect(result.resolverMetadata.invalid_name).toBe('Whiskers');
  });

  it('declines an unsupported message with a default when the resolver gives no message', async () => {
    vi.mocked(resolveTurn).mockResolvedValue(baseResolverOutput({ outcome: 'unsupported' }));

    const result = await runTurn('asdkfjhaskdjfh');

    expect(result.outcome).toBe('unsupported');
    expect(result.replyBody).toMatch(/only help with questions about your pet's stay/);
  });

  it('compares two pets by retrieving both records and grounding one answer', async () => {
    vi.mocked(resolveTurn).mockResolvedValue(
      baseResolverOutput({
        outcome: 'compare',
        pets_compare: ['Biscuit', 'Sato'],
        activity: 'feeding',
        booking_hint: 'Sep 8-10',
      }),
    );
    vi.mocked(findChatbotCaringInfo).mockImplementation(async (bookingPetId) => ({
      ...emptyCaringInfo,
      feeding_routine: bookingPetId === 'booking-biscuit-current' ? 'Biscuit food' : 'Sato food',
    }));
    vi.mocked(generateAnswer).mockResolvedValue('Biscuit eats more.');

    const result = await runTurn('Which one eats more?');

    expect(result.outcome).toBe('compare');
    expect(result.replyBody).toBe('Biscuit eats more.');
    expect(result.comparedPetsUuids).toEqual([BISCUIT.uuid, SATO.uuid]);
    expect(result.state.referenced_pets_uuids).toEqual([BISCUIT.uuid, SATO.uuid]);
    expect(generateAnswer).toHaveBeenCalledWith(
      'Which one eats more?',
      {
        Biscuit: { feeding_routine: 'Biscuit food' },
        Sato: { feeding_routine: 'Sato food' },
      },
      { replyLanguage: 'en' },
    );
  });

  it('summarizes every owned pet and each recorded stay for an all-pets request', async () => {
    vi.mocked(listPetsForOwner).mockResolvedValue([
      { ...ownedPetsFixture[0], breed: 'Spaniel', age: 5, weight: 18 },
      ownedPetsFixture[1],
    ] as never);
    vi.mocked(resolveTurn).mockResolvedValue(
      baseResolverOutput({ outcome: 'all_pets', pet: null, activity: null }),
    );
    vi.mocked(findChatbotCaringInfo).mockResolvedValue({
      ...emptyCaringInfo,
      feeding_routine: 'Two meals daily',
    });
    vi.mocked(findChatbotServicesForBooking).mockResolvedValue([
      { name: 'Chicken meal plan', category: 'food' },
    ]);

    const result = await runTurn('I want all pet information.');

    expect(result.outcome).toBe('clear');
    expect(result.topic).toBe('pet_overview');
    expect(result.resolverMetadata.pet_cards).toHaveLength(2);
    expect(result.resolverMetadata.pet_cards?.[0]).toMatchObject({
      profile: { name: 'Biscuit', species: 'dog', breed: 'Spaniel', age: 5, weight: 18 },
    });
    expect(result.resolverMetadata.pet_cards?.[0]?.stays[0]).toMatchObject({
      care_information: expect.objectContaining({ feeding_routine: 'Two meals daily' }),
      booked_services: [{ name: 'Chicken meal plan', category: 'food' }],
    });
    expect(result.petUuid).toBeNull();
    expect(result.state.referenced_pets_uuids).toEqual([BISCUIT.uuid, SATO.uuid]);
    expect(result.state.pending).toEqual({ pet_uuid: null, topic: null, request_text: null });
    expect(findChatbotCaringInfo).toHaveBeenCalledTimes(3);
    expect(findChatbotServicesForBooking).toHaveBeenCalledTimes(3);
    expect(generateAnswer).toHaveBeenCalledWith(
      'I want all pet information.',
      expect.objectContaining({
        pets: expect.arrayContaining([
          expect.objectContaining({
            profile: expect.objectContaining({
              name: 'Biscuit',
              breed: 'Spaniel',
              age: 5,
              weight: 18,
            }),
            stays: expect.arrayContaining([
              expect.objectContaining({
                care_information: expect.objectContaining({ feeding_routine: 'Two meals daily' }),
                booked_services: [{ name: 'Chicken meal plan', category: 'food' }],
              }),
            ]),
          }),
          expect.objectContaining({ profile: expect.objectContaining({ name: 'Sato' }) }),
        ]),
      }),
      { allPets: true, replyLanguage: 'en' },
    );
  });

  it('treats selecting the offered all-pets option as an explicit overview request', async () => {
    vi.mocked(findMessagesByConversation).mockResolvedValue([
      {
        sender_role: 'ai',
        outcome: 'ambiguous',
        resolver_metadata: { candidates: ['Biscuit', 'Sato', 'All my pets'] },
      },
      { sender_role: 'pet_owner', body: 'All my pets' },
    ] as never);

    const result = await runTurn('All my pets');

    expect(result.topic).toBe('pet_overview');
    expect(result.outcome).toBe('clear');
    expect(resolveTurn).not.toHaveBeenCalled();
    expect(generateAnswer).toHaveBeenCalledWith(
      'All my pets',
      expect.objectContaining({ pets: expect.any(Array) }),
      { allPets: true, replyLanguage: 'en' },
    );
  });

  it('routes the exact all-pets choice correctly even when the prior AI message has no saved options', async () => {
    vi.mocked(findMessagesByConversation).mockResolvedValue([
      {
        sender_role: 'ai',
        outcome: 'ambiguous',
        resolver_metadata: { candidates: null },
      },
      { sender_role: 'pet_owner', body: 'All my pets' },
    ] as never);
    vi.mocked(resolveTurn).mockResolvedValue(
      baseResolverOutput({ outcome: 'ambiguous', include_all_pets_option: true }),
    );

    const result = await runTurn('All my pets');

    expect(result.topic).toBe('pet_overview');
    expect(result.resolverMetadata.pet_cards).toHaveLength(2);
    expect(resolveTurn).not.toHaveBeenCalled();
    expect(generateAnswer).toHaveBeenCalledWith(
      'All my pets',
      expect.objectContaining({ pets: expect.any(Array) }),
      { allPets: true, replyLanguage: 'en' },
    );
  });

  it('answers a clear question grounded in the retrieved record', async () => {
    vi.mocked(resolveTurn).mockResolvedValue(
      baseResolverOutput({ pet: 'Biscuit', activity: 'feeding', booking_hint: 'current' }),
    );
    vi.mocked(findChatbotCaringInfo).mockResolvedValue({
      ...emptyCaringInfo,
      feeding_routine: '3 cups twice a day',
    });
    vi.mocked(generateAnswer).mockResolvedValue('Biscuit gets 3 cups twice a day.');

    const result = await runTurn("What's Biscuit's feeding routine?");

    expect(result.outcome).toBe('clear');
    expect(result.petUuid).toBe(BISCUIT.uuid);
    expect(result.bookingPetUuid).toBe('booking-biscuit-current');
    expect(result.replyBody).toBe('Biscuit gets 3 cups twice a day.');
    expect(result.resolverMetadata.pet_cards).toEqual([
      {
        profile: {
          name: 'Biscuit',
          species: 'dog',
          breed: null,
          age: null,
          weight: null,
        },
        stays: [],
        answer: 'Biscuit gets 3 cups twice a day.',
      },
    ]);
    expect(result.state.current_entity).toEqual({
      pet_uuid: BISCUIT.uuid,
      booking_pets_uuid: 'booking-biscuit-current',
    });
    expect(result.state.recent_topics).toEqual([{ pet_uuid: BISCUIT.uuid, topic: 'feeding' }]);
    expect(generateAnswer).toHaveBeenCalledWith(
      "What's Biscuit's feeding routine?",
      { feeding_routine: '3 cups twice a day' },
      { replyLanguage: 'en' },
    );
  });

  it('passes the language the parent reads to the model', async () => {
    vi.mocked(resolveTurn).mockResolvedValue(
      baseResolverOutput({ pet: 'Biscuit', activity: 'feeding', booking_hint: 'current' }),
    );
    vi.mocked(findChatbotCaringInfo).mockResolvedValue({
      ...emptyCaringInfo,
      feeding_routine: '3 cups twice a day',
    });
    vi.mocked(generateAnswer).mockResolvedValue('Biscuit 每天吃两次，每次 3 杯。');

    await generateAiTurn({
      ownerUuid: 'owner-1',
      conversationId: 'conv-1',
      state: emptyState(),
      userMessage: 'Biscuit 吃什么？',
      replyLanguage: 'zh',
    });

    expect(resolveTurn).toHaveBeenCalledWith(expect.objectContaining({ replyLanguage: 'zh' }));
    expect(generateAnswer).toHaveBeenCalledWith(
      'Biscuit 吃什么？',
      { feeding_routine: '3 cups twice a day' },
      { replyLanguage: 'zh' },
    );
  });

  it.each([
    ['current', 'booking-biscuit-current', 'Staying now'],
    ['Dec 10-15', 'booking-biscuit-upcoming', 'Waiting for review'],
  ])(
    "reports the %s stay's status in the parent's words, never 'paid'",
    async (bookingHint, bookingPetId, statusWords) => {
      vi.mocked(resolveTurn).mockResolvedValue(
        baseResolverOutput({ pet: 'Biscuit', activity: 'services', booking_hint: bookingHint }),
      );
      vi.mocked(findChatbotServicesForBooking).mockResolvedValue([
        { name: 'Standard room', category: 'boarding_rate' },
      ]);

      const result = await runTurn(`What did I book for Biscuit's ${bookingHint} stay?`);

      expect(result.bookingPetUuid).toBe(bookingPetId);
      expect(generateAnswer).toHaveBeenCalledWith(
        `What did I book for Biscuit's ${bookingHint} stay?`,
        expect.objectContaining({ boarding_rate: 'Standard room', status: statusWords }),
        { replyLanguage: 'en' },
      );
    },
  );

  it('asks which stay or all stays when a pet has multiple bookings and nothing disambiguates it', async () => {
    vi.mocked(resolveTurn).mockResolvedValue(
      baseResolverOutput({ pet: 'Biscuit', activity: 'feeding' }),
    );

    const result = await runTurn("What's Biscuit's feeding routine?");

    expect(result.outcome).toBe('ambiguous');
    expect(result.replyBody).toContain('Which stay are you referring to for Biscuit');
    // A request the manager has not approved is named by its status, never as an upcoming stay.
    expect(result.resolverMetadata.candidates).toEqual([
      'Sep 8-10 (current)',
      'Dec 10-15 (waiting for review)',
      'All stays',
    ]);
    expect(result.state.pending).toEqual({
      pet_uuid: BISCUIT.uuid,
      topic: 'feeding',
      request_text: "What's Biscuit's feeding routine?",
    });
    expect(result.state.current_entity).toBeNull();
    expect(generateAnswer).not.toHaveBeenCalled();
  });

  it('replays a repeated stay clarification without calling either model', async () => {
    vi.mocked(resolveTurn).mockResolvedValue(
      baseResolverOutput({ pet: 'Biscuit', activity: 'feeding' }),
    );
    const question = "What's Biscuit's feeding routine?";
    const firstClarification = await runTurn(question);
    const previousAiMessage = {
      sender_role: 'ai',
      body: firstClarification.replyBody,
      resolver_metadata: firstClarification.resolverMetadata,
    };
    vi.mocked(findMessagesByConversation).mockResolvedValue([previousAiMessage] as never);
    vi.mocked(resolveTurn).mockClear();
    vi.mocked(generateAnswer).mockClear();

    const repeated = await runTurn(question, firstClarification.state);

    expect(repeated.outcome).toBe('ambiguous');
    expect(repeated.resolverMetadata.candidates).toContain('All stays');
    expect(resolveTurn).not.toHaveBeenCalled();
    expect(generateAnswer).not.toHaveBeenCalled();
  });

  it('answers all stays together and caches the response for the original question', async () => {
    vi.mocked(resolveTurn).mockResolvedValue(
      baseResolverOutput({ pet: 'Biscuit', activity: 'feeding' }),
    );
    vi.mocked(findChatbotCaringInfo).mockImplementation(async (bookingPetId) => ({
      ...emptyCaringInfo,
      feeding_routine: `${bookingPetId} food`,
    }));
    const question = "What's Biscuit's feeding routine?";
    const clarification = await runTurn(question);

    const result = await runTurn('All stays', clarification.state);

    expect(resolveTurn).toHaveBeenCalledTimes(1);
    expect(result.outcome).toBe('clear');
    expect(result.bookingPetUuid).toBeNull();
    expect(generateAnswer).toHaveBeenCalledWith(
      question,
      expect.objectContaining({
        stays: expect.arrayContaining([
          expect.objectContaining({ stay: 'Sep 8-10 (current)' }),
          expect.objectContaining({ stay: 'Dec 10-15 (waiting for review)' }),
        ]),
      }),
      { allStays: true, replyLanguage: 'en' },
    );
    expect(result.resolverMetadata.stay_answer_cache).toMatchObject({
      pet_uuid: BISCUIT.uuid,
      booking_pets_uuids: ['booking-biscuit-current', 'booking-biscuit-upcoming'],
      activity: 'feeding',
      all_stays: true,
    });
  });

  it('reuses an all-stays answer after repeating the question and choosing All stays again', async () => {
    vi.mocked(resolveTurn).mockResolvedValue(
      baseResolverOutput({ pet: 'Biscuit', activity: 'feeding' }),
    );
    const question = "What's Biscuit's feeding routine?";
    const clarification = await runTurn(question);
    const firstAnswer = await runTurn('All stays', clarification.state);
    vi.mocked(findMessagesByConversation).mockResolvedValue([
      {
        sender_role: 'ai',
        body: clarification.replyBody,
        resolver_metadata: clarification.resolverMetadata,
      },
      {
        sender_role: 'ai',
        body: firstAnswer.replyBody,
        resolver_metadata: firstAnswer.resolverMetadata,
      },
    ] as never);
    vi.mocked(resolveTurn).mockClear();
    vi.mocked(generateAnswer).mockClear();

    const repeatedClarification = await runTurn(question, firstAnswer.state);
    const repeatedAnswer = await runTurn('All stays', repeatedClarification.state);

    expect(repeatedAnswer.replyBody).toBe(firstAnswer.replyBody);
    expect(resolveTurn).not.toHaveBeenCalled();
    expect(generateAnswer).not.toHaveBeenCalled();
  });

  it('reuses an answer for the same unchanged stay and skips both model calls', async () => {
    vi.mocked(resolveTurn).mockResolvedValue(
      baseResolverOutput({ pet: 'Biscuit', activity: 'feeding', booking_hint: 'Sep 8-10' }),
    );
    vi.mocked(findChatbotCaringInfo).mockResolvedValue({
      ...emptyCaringInfo,
      feeding_routine: 'Two meals daily',
    });
    const question = "What's Biscuit's feeding routine for Sep 8-10?";
    const firstAnswer = await runTurn(question);
    const previousAiMessage = {
      sender_role: 'ai',
      body: firstAnswer.replyBody,
      resolver_metadata: firstAnswer.resolverMetadata,
    };
    vi.mocked(findMessagesByConversation).mockResolvedValue([previousAiMessage] as never);
    vi.mocked(resolveTurn).mockClear();
    vi.mocked(generateAnswer).mockClear();

    const repeated = await runTurn(question, firstAnswer.state);

    expect(repeated.replyBody).toBe(firstAnswer.replyBody);
    expect(repeated.resolverMetadata.pet_cards?.[0]?.answer).toBe(firstAnswer.replyBody);
    expect(resolveTurn).not.toHaveBeenCalled();
    expect(generateAnswer).not.toHaveBeenCalled();
  });

  it('reuses the same selected stay after replaying its clarification without model calls', async () => {
    const question = "What's Biscuit's feeding routine?";
    vi.mocked(resolveTurn).mockResolvedValue(
      baseResolverOutput({ pet: 'Biscuit', activity: 'feeding' }),
    );
    const clarification = await runTurn(question);
    vi.mocked(resolveTurn).mockResolvedValue(
      baseResolverOutput({ pet: 'Biscuit', booking_hint: 'Dec 10-15' }),
    );
    vi.mocked(findChatbotCaringInfo).mockResolvedValue({
      ...emptyCaringInfo,
      feeding_routine: 'Two meals daily',
    });
    const firstAnswer = await runTurn('Dec 10-15 (waiting for review)', clarification.state);
    const clarificationMessage = {
      sender_role: 'ai',
      body: clarification.replyBody,
      resolver_metadata: clarification.resolverMetadata,
    };
    const answerMessage = {
      sender_role: 'ai',
      body: firstAnswer.replyBody,
      resolver_metadata: firstAnswer.resolverMetadata,
    };
    vi.mocked(findMessagesByConversation).mockResolvedValue([
      clarificationMessage,
      answerMessage,
    ] as never);
    vi.mocked(resolveTurn).mockClear();
    vi.mocked(generateAnswer).mockClear();

    const replayedClarification = await runTurn(question, firstAnswer.state);
    const replayedAnswer = await runTurn(
      'Dec 10-15 (waiting for review)',
      replayedClarification.state,
    );

    expect(replayedClarification.outcome).toBe('ambiguous');
    expect(replayedAnswer.replyBody).toBe(firstAnswer.replyBody);
    expect(resolveTurn).not.toHaveBeenCalled();
    expect(generateAnswer).not.toHaveBeenCalled();
  });

  it('does not reuse a cached answer after the stay records change', async () => {
    vi.mocked(resolveTurn).mockResolvedValue(
      baseResolverOutput({ pet: 'Biscuit', activity: 'feeding', booking_hint: 'Sep 8-10' }),
    );
    vi.mocked(findChatbotCaringInfo).mockResolvedValue({
      ...emptyCaringInfo,
      feeding_routine: 'Two meals daily',
    });
    const question = "What's Biscuit's feeding routine for Sep 8-10?";
    const firstAnswer = await runTurn(question);
    vi.mocked(findMessagesByConversation).mockResolvedValue([
      {
        sender_role: 'ai',
        body: firstAnswer.replyBody,
        resolver_metadata: firstAnswer.resolverMetadata,
      },
    ] as never);
    vi.mocked(findChatbotCaringInfo).mockResolvedValue({
      ...emptyCaringInfo,
      feeding_routine: 'Three meals daily',
    });
    vi.mocked(resolveTurn).mockClear();
    vi.mocked(generateAnswer).mockClear();

    await runTurn(question, firstAnswer.state);

    expect(resolveTurn).toHaveBeenCalledTimes(1);
    expect(generateAnswer).toHaveBeenCalledTimes(1);
  });

  it('does not reuse an unqualified single-stay answer after another stay is added', async () => {
    vi.mocked(resolveTurn).mockResolvedValue(
      baseResolverOutput({ pet: 'Biscuit', activity: 'feeding' }),
    );
    vi.mocked(findChatbotBookingsForPets).mockResolvedValue(
      bookingRowsFixture.filter(
        (booking) => booking.bookingPetId !== 'booking-biscuit-upcoming',
      ) as never,
    );
    const question = "What's Biscuit's feeding routine?";
    const firstAnswer = await runTurn(question);
    vi.mocked(findMessagesByConversation).mockResolvedValue([
      {
        sender_role: 'ai',
        body: firstAnswer.replyBody,
        resolver_metadata: firstAnswer.resolverMetadata,
      },
    ] as never);
    vi.mocked(findChatbotBookingsForPets).mockResolvedValue(bookingRowsFixture as never);
    vi.mocked(resolveTurn).mockClear();
    vi.mocked(generateAnswer).mockClear();

    const repeated = await runTurn(question, firstAnswer.state);

    expect(repeated.outcome).toBe('ambiguous');
    expect(repeated.resolverMetadata.candidates).toContain('All stays');
    expect(resolveTurn).toHaveBeenCalledTimes(1);
    expect(generateAnswer).not.toHaveBeenCalled();
  });

  it('does not trust a generic "my pet" echoed back as a name when there is more than one pet', async () => {
    vi.mocked(resolveTurn).mockResolvedValue(
      baseResolverOutput({ pet: 'my pet', activity: 'feeding' }),
    );

    const result = await runTurn("What's my pet's feeding routine?");

    expect(result.outcome).toBe('ambiguous');
    expect(result.replyBody).toBe('Which pet are you asking about?');
    expect(result.resolverMetadata.candidates).toEqual(['Biscuit', 'Sato']);
  });

  it('does not trust a pet pick the model invented without it being named, anchored, or pending', async () => {
    vi.mocked(resolveTurn).mockResolvedValue(
      baseResolverOutput({ pet: 'Sato', activity: 'feeding' }),
    );

    const result = await runTurn('How is the feeding going?');

    expect(result.outcome).toBe('ambiguous');
    expect(result.replyBody).toBe('Which pet are you asking about?');
    expect(result.resolverMetadata.candidates).toEqual(['Biscuit', 'Sato']);
  });

  it('treats a pet name the model produced that matches no real pet as invalid', async () => {
    vi.mocked(resolveTurn).mockResolvedValue(
      baseResolverOutput({ pet: 'Rex', activity: 'feeding' }),
    );

    const result = await runTurn('How is Rex doing?');

    expect(result.outcome).toBe('invalid');
    expect(result.replyBody).toBe("I don't have a pet named Rex associated with your account.");
  });

  it('asks again for a bare pronoun once more than one pet has been referenced, even when anchored', async () => {
    vi.mocked(resolveTurn).mockResolvedValue(
      baseResolverOutput({ pet: 'Biscuit', activity: 'feeding' }),
    );
    const state = emptyState();
    state.current_entity = { pet_uuid: BISCUIT.uuid, booking_pets_uuid: 'booking-biscuit-current' };
    state.referenced_pets_uuids = [BISCUIT.uuid, SATO.uuid];

    const result = await runTurn('How long did he sleep?', state);

    expect(result.outcome).toBe('ambiguous');
    expect(result.replyBody).toBe('Which pet are you asking about?');
    expect(result.resolverMetadata.candidates).toEqual(['Biscuit', 'Sato']);
  });

  it('inherits the pending activity when a short reply only confirms the pet', async () => {
    vi.mocked(resolveTurn).mockResolvedValue(
      baseResolverOutput({ pet: 'Biscuit', activity: null, booking_hint: 'current' }),
    );
    const state = emptyState();
    state.pending = { pet_uuid: BISCUIT.uuid, topic: 'medication', request_text: null };
    vi.mocked(findChatbotCaringInfo).mockResolvedValue({
      ...emptyCaringInfo,
      medication_instructions: 'none',
    });

    const result = await runTurn('current stay', state);

    expect(result.topic).toBe('medication');
    expect(generateAnswer).toHaveBeenCalledWith(
      'current stay',
      { medication_instructions: 'none' },
      { replyLanguage: 'en' },
    );
  });

  it('answers booking_info directly without calling the answer-generation LLM', async () => {
    vi.mocked(resolveTurn).mockResolvedValue(
      baseResolverOutput({ pet: 'Sato', activity: 'booking_info' }),
    );

    const result = await runTurn("What's Sato's booking id?");

    expect(result.replyBody).toBe(
      "Sato's booking id is booking-sato-current, for the stay Sep 8-10 (current).",
    );
    expect(generateAnswer).not.toHaveBeenCalled();
  });
});
