import { describe, expect, it, vi } from 'vitest';

// stayLabel formats dates using local-time Date methods. Pin the process
// timezone so the expected strings below don't depend on the host machine's
// own local timezone (e.g. a machine set to Pacific/Auckland would otherwise
// shift a midday-UTC timestamp across a calendar day).
process.env.TZ = 'UTC';

const modelMocks = vi.hoisted(() => ({
  generateObject: vi.fn(),
  generateText: vi.fn(),
}));

vi.mock('ai', () => ({
  generateObject: modelMocks.generateObject,
  generateText: modelMocks.generateText,
}));

import {
  namesPet,
  isGenericPetReference,
  barePronounOnly,
  stayLabel,
  matchBookingHint,
  resolveBooking,
  buildPetsBlock,
  toResolverBookings,
  resolveTurn,
  generateAnswer,
  asksBroadlyAboutPets,
  explicitlyRequestsAllPets,
  type ResolverOutput,
  type ResolverPet,
  type ResolverBooking,
} from '../services/conversation.resolver.js';
import type { ReviewedStay } from '../services/stay-status.js';
import type { ManagerReviewStatus } from '../contracts/stay-status.contract.js';
import type { ChatbotBookingRow } from '../repositories/petparent.chatbot.repository.js';

// Pure guardrail/formatting helpers, ported from AiChatbox/chatbot_harness.py
// and AiChatbox/mock_data.py. These run against real conversation state and
// real Postgres data, so their correctness is load-bearing for the whole AI
// chatbot pipeline (see conversation.ai.service.test.ts for the orchestrator
// that relies on them).

describe('namesPet', () => {
  it('matches a pet name as a whole word, case-insensitively', () => {
    expect(namesPet('Max', 'How is Max doing?')).toBe(true);
    expect(namesPet('Max', 'how is max doing')).toBe(true);
  });

  it('does not match a substring of another word', () => {
    expect(namesPet('Max', 'Maxi is a good dog')).toBe(false);
  });
});

describe('explicitlyRequestsAllPets', () => {
  it('recognizes direct requests for all-pet information', () => {
    expect(explicitlyRequestsAllPets('I want all pet information.')).toBe(true);
    expect(explicitlyRequestsAllPets('Tell me all about my pets.')).toBe(true);
    expect(explicitlyRequestsAllPets('Give me details for every pet.')).toBe(true);
    expect(explicitlyRequestsAllPets('All my pets')).toBe(true);
  });

  it('does not treat a broad plural question as an explicit all-pets request', () => {
    expect(explicitlyRequestsAllPets('How are my pets?')).toBe(false);
    expect(explicitlyRequestsAllPets('I love all my pets.')).toBe(false);
  });
});

describe('asksBroadlyAboutPets', () => {
  it('recognizes plural questions that should offer pet and all-pets choices', () => {
    expect(asksBroadlyAboutPets('How are my pets?')).toBe(true);
    expect(asksBroadlyAboutPets('Tell me about the pets.')).toBe(true);
  });

  it('leaves explicit all-pet information requests to the overview flow', () => {
    expect(asksBroadlyAboutPets('How are all my pets?')).toBe(false);
  });
});

describe('isGenericPetReference', () => {
  it('flags vague possessive phrases', () => {
    expect(isGenericPetReference('my pet')).toBe(true);
    expect(isGenericPetReference('The Dog')).toBe(true);
    expect(isGenericPetReference('  our pet  ')).toBe(true);
  });

  it('does not flag an actual pet name', () => {
    expect(isGenericPetReference('Biscuit')).toBe(false);
  });
});

describe('barePronounOnly', () => {
  const pets: ResolverPet[] = [
    { uuid: 'p1', name: 'Biscuit' },
    { uuid: 'p2', name: 'Sato' },
  ];

  it('is true for a 3rd-person pronoun with no pet named', () => {
    expect(barePronounOnly('How long did he sleep?', pets)).toBe(true);
  });

  it('is false when a pet is named alongside the pronoun', () => {
    expect(barePronounOnly('How long did Biscuit sleep, is he ok?', pets)).toBe(false);
  });

  it('is false with no pronoun at all', () => {
    expect(barePronounOnly("What's the feeding routine?", pets)).toBe(false);
  });
});

describe('stayLabel', () => {
  // Midday, so a +/-12h local timezone offset never shifts the calendar day.
  const NOW = new Date('2026-09-09T12:00:00Z');
  const approved = (dropOff: string, pickUp: string): ReviewedStay => ({
    reviewStatus: 'approved',
    checkInOutcome: null,
    dropOffTime: new Date(dropOff),
    pickUpTime: new Date(pickUp),
  });

  it('tags an approved stay spanning today as current', () => {
    expect(stayLabel(approved('2026-09-08T12:00:00Z', '2026-09-10T12:00:00Z'), NOW)).toBe(
      'Sep 8-10 (current)',
    );
  });

  it('tags an approved future stay as upcoming, spelling out both months when they differ', () => {
    expect(stayLabel(approved('2026-11-28T12:00:00Z', '2026-12-02T12:00:00Z'), NOW)).toBe(
      'Nov 28 - Dec 2 (upcoming)',
    );
  });

  it('tags an approved stay that already ended as past', () => {
    expect(stayLabel(approved('2026-01-01T12:00:00Z', '2026-01-03T12:00:00Z'), NOW)).toBe(
      'Jan 1-3 (past)',
    );
  });

  it.each([
    ['pending', 'waiting for review'],
    ['refused', 'not accepted'],
    ['cancelled', 'cancelled'],
  ] as const)(
    'never tags a %s request by the clock, even while its dates run today',
    (reviewStatus, words) => {
      const today = { ...approved('2026-09-08T12:00:00Z', '2026-09-10T12:00:00Z'), reviewStatus };
      expect(stayLabel(today, NOW)).toBe(`Sep 8-10 (${words})`);
    },
  );
});

describe('matchBookingHint', () => {
  const bookings: ResolverBooking[] = [
    { bookingPetId: 'b1', petUuid: 'p1', stayLabel: 'Sep 8-10 (current)' },
    { bookingPetId: 'b2', petUuid: 'p1', stayLabel: 'Dec 10-15 (upcoming)' },
  ];

  it('matches on a "current"/"upcoming"/"past" tag', () => {
    expect(matchBookingHint(bookings, 'his current stay')?.bookingPetId).toBe('b1');
    expect(matchBookingHint(bookings, 'the upcoming one')?.bookingPetId).toBe('b2');
  });

  it('matches on a date-range substring', () => {
    expect(matchBookingHint(bookings, 'Sep 8-10')?.bookingPetId).toBe('b1');
  });

  it('returns null with no hint or when nothing matches', () => {
    expect(matchBookingHint(bookings, null)).toBeNull();
    expect(matchBookingHint(bookings, 'next July')).toBeNull();
  });
});

describe('resolveBooking', () => {
  const twoBookings: ResolverBooking[] = [
    { bookingPetId: 'b1', petUuid: 'p1', stayLabel: 'Sep 8-10 (current)' },
    { bookingPetId: 'b2', petUuid: 'p1', stayLabel: 'Dec 10-15 (upcoming)' },
  ];
  const oneBooking: ResolverBooking[] = [
    { bookingPetId: 'b3', petUuid: 'p2', stayLabel: 'Sep 8-10 (current)' },
  ];

  it('prefers an explicit hint match over the anchored booking', () => {
    const result = resolveBooking('Biscuit', twoBookings, 'upcoming');
    expect(result).toEqual({
      bookingPetId: 'b2',
      stayLabelText: 'Dec 10-15 (upcoming)',
      clarify: null,
    });
  });

  it("uses the pet's only booking when there is no hint", () => {
    expect(resolveBooking('Sato', oneBooking, null).bookingPetId).toBe('b3');
  });

  it('asks even when a previous turn anchored one of multiple stays', () => {
    const result = resolveBooking('Biscuit', twoBookings, null);

    expect(result.bookingPetId).toBeNull();
    expect(result.clarify).toContain('or would you like information about all stays?');
  });

  it('asks rather than guesses when nothing disambiguates', () => {
    const result = resolveBooking('Biscuit', twoBookings, null);
    expect(result.bookingPetId).toBeNull();
    expect(result.clarify).toContain('Which stay are you referring to for Biscuit');
    expect(result.clarify).toContain('Sep 8-10 (current)');
    expect(result.clarify).toContain('Dec 10-15 (upcoming)');
  });
});

describe('buildPetsBlock', () => {
  it('lists each pet with its bookings, or "(none)" when it has none', () => {
    const pets: ResolverPet[] = [
      { uuid: 'p1', name: 'Biscuit' },
      { uuid: 'p2', name: 'Whiskers' },
    ];
    const bookings: ResolverBooking[] = [
      { bookingPetId: 'b1', petUuid: 'p1', stayLabel: 'Sep 8-10 (current)' },
    ];

    expect(buildPetsBlock(pets, bookings)).toBe(
      '- Biscuit: bookings = Sep 8-10 (current)\n- Whiskers: bookings = (none)',
    );
  });
});

describe('latest and next event resolution', () => {
  const pets: ResolverPet[] = [
    { uuid: 'p1', name: 'Pepper' },
    { uuid: 'p2', name: 'Biscuit' },
  ];

  it('keeps the selected pet when the parent asks for its latest event without repeating the name', async () => {
    modelMocks.generateObject.mockClear();
    const resolution = await resolveTurn({
      pets,
      bookings: [],
      contextBlock: 'Current entity: pet = Pepper',
      currentEntityPet: pets[0] ?? null,
      history: [],
      userMessage: 'What is the latest event?',
    });

    expect(resolution).toMatchObject({
      outcome: 'clear',
      pet: 'Pepper',
      activity: 'latest_event',
      message: null,
    });
    expect(modelMocks.generateObject).not.toHaveBeenCalled();
  });

  it('uses a pet explicitly named in the event question instead of the previous selection', async () => {
    const resolution = await resolveTurn({
      pets,
      bookings: [],
      contextBlock: 'Current entity: pet = Pepper',
      currentEntityPet: pets[0] ?? null,
      history: [],
      userMessage: 'What was Biscuit’s latest event?',
    });

    expect(resolution).toMatchObject({
      outcome: 'clear',
      pet: 'Biscuit',
      activity: 'latest_event',
    });
  });

  it('still asks which pet when there is no selected pet and the account has multiple pets', async () => {
    const resolution = await resolveTurn({
      pets,
      bookings: [],
      contextBlock: '(none yet)',
      currentEntityPet: null,
      history: [],
      userMessage: 'What is the latest event?',
    });

    expect(resolution).toMatchObject({
      outcome: 'ambiguous',
      pet: null,
      activity: 'latest_event',
      include_all_pets_option: true,
      message: 'Which pet are you asking about?',
    });
  });
});

describe('toResolverBookings', () => {
  const NOW = new Date('2026-09-09T12:00:00Z');
  const row = (
    bookingPetId: string,
    reviewStatus: ManagerReviewStatus,
    dropOff: string,
    pickUp: string,
  ): ChatbotBookingRow => ({
    bookingPetId,
    petUuid: 'p1',
    dropOffTime: new Date(dropOff),
    pickUpTime: new Date(pickUp),
    reviewStatus,
    checkInOutcome: null,
  });

  it('labels each row by its parent stay status while preserving its identity', () => {
    const result = toResolverBookings(
      [row('b1', 'approved', '2026-09-08T12:00:00Z', '2026-09-10T12:00:00Z')],
      NOW,
    );

    expect(result).toEqual([
      { bookingPetId: 'b1', petUuid: 'p1', stayLabel: 'Sep 8-10 (current)' },
    ]);
  });

  it('never lets a pending or refused request answer for the current or upcoming stay', () => {
    const bookings = toResolverBookings(
      [
        row('pending-today', 'pending', '2026-09-08T12:00:00Z', '2026-09-10T12:00:00Z'),
        row('refused-today', 'refused', '2026-09-08T12:00:00Z', '2026-09-10T12:00:00Z'),
        row('pending-later', 'pending', '2026-12-10T12:00:00Z', '2026-12-15T12:00:00Z'),
      ],
      NOW,
    );

    expect(bookings.map((booking) => booking.stayLabel)).toEqual([
      'Sep 8-10 (waiting for review)',
      'Sep 8-10 (not accepted)',
      'Dec 10-15 (waiting for review)',
    ]);
    expect(matchBookingHint(bookings, 'his current stay')).toBeNull();
    expect(matchBookingHint(bookings, 'the upcoming one')).toBeNull();
    expect(resolveBooking('Biscuit', bookings, 'current')).toMatchObject({
      bookingPetId: null,
      clarify: expect.stringContaining('Sep 8-10 (not accepted)'),
    });
  });
});

describe('model text shown to the pet parent', () => {
  const resolverOutput: ResolverOutput = {
    intent: 'qa',
    outcome: 'ambiguous',
    pet: null,
    pets_compare: null,
    activity: 'feeding',
    booking_hint: 'Sep 8\u201310',
    candidates: ['Biscuit', 'Sato'],
    include_all_pets_option: false,
    invalid_name: null,
    message: 'Do you mean Biscuit or Sato \u2014 or both?',
  };

  it('removes dashes from the clarifying message but keeps the booking hint as written', async () => {
    modelMocks.generateObject.mockResolvedValueOnce({ object: resolverOutput });

    const resolution = await resolveTurn({
      pets: [
        { uuid: 'p1', name: 'Biscuit' },
        { uuid: 'p2', name: 'Sato' },
      ],
      bookings: [],
      contextBlock: '(none yet)',
      history: [],
      userMessage: 'What does my dog eat?',
    });

    expect(resolution.message).toBe('Do you mean Biscuit or Sato, or both?');
    expect(resolution.booking_hint).toBe('Sep 8\u201310');
    const request = modelMocks.generateObject.mock.calls[0]?.[0] as { system: string };
    expect(request.system).toContain(
      'Write "message" in plain punctuation. Never use em dashes or en dashes.',
    );
  });

  it('repairs a nested JSON object wrapper returned by the model', async () => {
    modelMocks.generateObject.mockResolvedValueOnce({ object: resolverOutput });

    await resolveTurn({
      pets: [{ uuid: 'p1', name: 'Biscuit' }],
      bookings: [],
      contextBlock: '(none yet)',
      history: [],
      userMessage: 'How is Biscuit doing?',
    });

    const request = modelMocks.generateObject.mock.calls[0]?.[0] as {
      repairText?: (options: { text: string; error: unknown }) => Promise<string | null>;
    };
    expect(request.repairText).toBeDefined();
    const repaired = await request.repairText?.({
      text: '{"{"intent":"qa","outcome":"clear","pet":"Biscuit","pets_compare":null,"activity":"feeding","booking_hint":null,"candidates":[],"include_all_pets_option":false,"invalid_name":null,"message":null}',
      error: new Error('invalid JSON'),
    });

    expect(repaired).toBe(
      '{"intent":"qa","outcome":"clear","pet":"Biscuit","pets_compare":null,"activity":"feeding","booking_hint":null,"candidates":[],"include_all_pets_option":false,"invalid_name":null,"message":null}',
    );
  });

  it('removes dashes from the answer and asks the model for plain punctuation', async () => {
    modelMocks.generateText.mockResolvedValueOnce({
      text: 'Biscuit eats at 8:00 and 18:00 \u2014 with warm water.',
    });

    const answer = await generateAnswer('When does Biscuit eat?', { feeding_routine: 'twice' });

    expect(answer).toBe('Biscuit eats at 8:00 and 18:00, with warm water.');
    const request = modelMocks.generateText.mock.calls[0]?.[0] as { system: string };
    expect(request.system).toContain('Use plain punctuation. Never use em dashes or en dashes.');
  });

  // A parent reading Chinese gets Chinese; stored names stay as written so matching still works.
  it('asks the model for Chinese when the parent reads Chinese, and only then', async () => {
    modelMocks.generateText.mockResolvedValue({ text: 'Biscuit 每天吃两次。' });
    modelMocks.generateObject.mockResolvedValueOnce({ object: resolverOutput });

    await generateAnswer('Biscuit 吃什么？', { feeding_routine: 'twice' }, { replyLanguage: 'zh' });
    await generateAnswer('What does Biscuit eat?', { feeding_routine: 'twice' });
    await resolveTurn({
      pets: [{ uuid: 'p1', name: 'Biscuit' }],
      bookings: [],
      contextBlock: '(none yet)',
      history: [],
      userMessage: 'Biscuit 吃什么？',
      replyLanguage: 'zh',
    });

    const [chinese, english] = modelMocks.generateText.mock.calls
      .slice(-2)
      .map(([request]) => (request as { system: string }).system);
    expect(chinese).toContain('Write your answer in Simplified Chinese.');
    expect(chinese).toContain('Keep pet names');
    expect(english).not.toContain('Simplified Chinese');
    const resolver = modelMocks.generateObject.mock.calls.at(-1)?.[0] as { system: string };
    expect(resolver.system).toContain('Write only the "message" field in Simplified Chinese.');
  });

  it('accepts the all-pets overview classification for a comprehensive request', async () => {
    modelMocks.generateObject.mockResolvedValueOnce({
      object: {
        intent: 'qa',
        outcome: 'all_pets',
        pet: null,
        pets_compare: null,
        activity: null,
        booking_hint: null,
        candidates: [],
        invalid_name: null,
        message: null,
      },
    });

    const resolution = await resolveTurn({
      pets: [{ uuid: 'p1', name: 'Biscuit' }],
      bookings: [],
      contextBlock: '(none yet)',
      history: [],
      userMessage: 'I want all pet information.',
    });

    expect(resolution.outcome).toBe('all_pets');
    const request = modelMocks.generateObject.mock.calls[0]?.[0] as { system: string };
    expect(request.system).toContain('all available information about every pet');
  });

  it('asks the answer model to group an all-pets overview by pet and stay', async () => {
    modelMocks.generateText.mockClear();
    modelMocks.generateText.mockResolvedValueOnce({ text: 'Biscuit has one stay.' });

    await generateAnswer('I want all pet information.', { pets: [] }, { allPets: true });

    const request = modelMocks.generateText.mock.calls[0]?.[0] as { system: string };
    expect(request.system).toContain('grouped by pet');
    expect(request.system).toContain('Do not collapse details from different pets or stays.');
  });
});
