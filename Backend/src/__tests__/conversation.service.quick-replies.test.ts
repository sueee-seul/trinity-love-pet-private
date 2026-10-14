import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const serviceMocks = vi.hoisted(() => ({
  findConversationById: vi.fn(),
  touchConversation: vi.fn(),
  updateConversationState: vi.fn(),
  createPetOwnerMessage: vi.fn(),
  createAiMessage: vi.fn(),
  publishConversationEvent: vi.fn(),
  publishInquiryCreated: vi.fn(),
  generateAiTurn: vi.fn(),
}));

vi.mock('../repositories/conversation.repository.js', () => ({
  findConversationById: serviceMocks.findConversationById,
  touchConversation: serviceMocks.touchConversation,
  updateConversationState: serviceMocks.updateConversationState,
}));

vi.mock('../repositories/message.repository.js', () => ({
  createPetOwnerMessage: serviceMocks.createPetOwnerMessage,
  createAiMessage: serviceMocks.createAiMessage,
}));

vi.mock('../services/conversation.events.js', () => ({
  publishConversationEvent: serviceMocks.publishConversationEvent,
  publishInquiryCreated: serviceMocks.publishInquiryCreated,
}));

vi.mock('../services/conversation.ai.service.js', () => ({
  generateAiTurn: serviceMocks.generateAiTurn,
}));

import { postPetOwnerMessage, toMessageDto } from '../services/conversation.service.js';

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('toMessageDto quick replies', () => {
  it('exposes stored candidate names only for ambiguous AI messages', (): void => {
    const message = {
      _id: {
        toString(): string {
          return 'message-1';
        },
      },
      conversations_uuid: 'conversation-1',
      created_at: new Date('2026-09-30T00:00:00Z'),
      sender_role: 'ai',
      topic: null,
      body: 'Which pet are you asking about?',
      employees_uuid: null,
      employees_display_name: null,
      pets_uuid: null,
      booking_pets_uuid: null,
      intent: 'qa',
      outcome: 'ambiguous',
      compared_pets_uuids: null,
      resolver_metadata: {
        candidates: ['Biscuit', 'Sato'],
        invalid_name: null,
        booking_hint: null,
      },
    };

    expect(toMessageDto(message as never).quick_replies).toEqual(['Biscuit', 'Sato']);
    expect(
      toMessageDto({ ...message, sender_role: 'staff' } as never).quick_replies,
    ).toBeUndefined();
  });
});

describe('toMessageDto pet overview cards', () => {
  it('exposes stored pet cards on an AI message', () => {
    const petCards = [
      {
        profile: { name: 'Biscuit', species: 'dog', breed: null, age: 5, weight: 18 },
        stays: [],
      },
    ];
    const message = {
      _id: { toString: (): string => 'message-2' },
      conversations_uuid: 'conversation-1',
      created_at: new Date('2026-09-30T00:00:00Z'),
      sender_role: 'ai',
      topic: 'pet_overview',
      body: 'Pet overview',
      employees_uuid: null,
      employees_display_name: null,
      pets_uuid: null,
      booking_pets_uuid: null,
      intent: 'qa',
      outcome: 'clear',
      compared_pets_uuids: null,
      resolver_metadata: {
        candidates: null,
        invalid_name: null,
        booking_hint: null,
        pet_cards: petCards,
      },
    };

    expect(toMessageDto(message as never).pet_cards).toEqual(petCards);
    expect(toMessageDto({ ...message, sender_role: 'staff' } as never).pet_cards).toBeUndefined();
  });
});

describe('postPetOwnerMessage AI failure handling', () => {
  it('persists and publishes a fallback when AI generation fails', async () => {
    const conversationId = 'conversation-1';
    serviceMocks.findConversationById.mockResolvedValueOnce({
      _id: { toString: (): string => conversationId },
      pet_owners_uuid: 'owner-1',
      status: 'active',
      support_status: 'ai_handling',
      current_entity: null,
      pending: { pet_uuid: null, topic: null, request_text: null },
      referenced_pets_uuids: [],
      recent_topics: [],
    });
    serviceMocks.createPetOwnerMessage.mockResolvedValueOnce({
      _id: { toString: (): string => 'user-message-1' },
      conversations_uuid: conversationId,
      created_at: new Date('2026-10-05T00:00:00Z'),
      sender_role: 'pet_owner',
      topic: null,
      body: 'How is Biscuit?',
      employees_uuid: null,
      employees_display_name: null,
      pets_uuid: null,
      booking_pets_uuid: null,
      intent: 'qa',
      outcome: 'clear',
      compared_pets_uuids: null,
      resolver_metadata: {
        candidates: null,
        invalid_name: null,
        booking_hint: null,
      },
    });
    serviceMocks.touchConversation.mockResolvedValueOnce(undefined);
    serviceMocks.generateAiTurn.mockRejectedValueOnce(new Error('Model output was invalid'));
    serviceMocks.createAiMessage.mockResolvedValueOnce(undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await postPetOwnerMessage(conversationId, 'owner-1', 'How is Biscuit?');

    await vi.waitFor(() => {
      expect(serviceMocks.createAiMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId,
          body: expect.stringContaining("couldn't complete that response"),
          outcome: 'unsupported',
        }),
      );
      expect(serviceMocks.publishConversationEvent).toHaveBeenCalledWith(conversationId);
    });
  });
});
