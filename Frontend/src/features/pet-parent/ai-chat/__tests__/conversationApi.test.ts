import { describe, expect, it } from 'vitest';
import { mapConversation } from '../conversationApi';

function baseApiConversation(
  messages: Parameters<typeof mapConversation>[0]['messages'],
): Parameters<typeof mapConversation>[0] {
  return {
    uuid: 'conv-1',
    pet_owners_uuid: 'owner-1',
    status: 'active' as const,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    current_entity: null,
    support_status: 'support_handling' as const,
    messages,
  };
}

describe('mapConversation: staff message author name', () => {
  it("labels a staff reply with the sender's real name, so the pet owner knows who they're talking to", () => {
    const conversation = baseApiConversation([
      {
        uuid: 'm1',
        conversations_uuid: 'conv-1',
        created_at: new Date().toISOString(),
        sender_role: 'staff',
        topic: null,
        body: 'Hi, how can I help?',
        employees_uuid: 'staff-uuid-1',
        employees_display_name: 'Tom Reilly',
        pets_uuid: null,
        booking_pets_uuid: null,
      },
    ]);

    const result = mapConversation(conversation, new Map());

    expect(result.messages[0]).toMatchObject({ senderRole: 'support', authorName: 'Tom Reilly' });
  });

  it('leaves authorName unset for an older staff message with no stored display name', () => {
    const conversation = baseApiConversation([
      {
        uuid: 'm1',
        conversations_uuid: 'conv-1',
        created_at: new Date().toISOString(),
        sender_role: 'staff',
        topic: null,
        body: 'Hi, how can I help?',
        employees_uuid: 'staff-uuid-1',
        employees_display_name: null,
        pets_uuid: null,
        booking_pets_uuid: null,
      },
    ]);

    const result = mapConversation(conversation, new Map());

    expect(result.messages[0].authorName).toBeUndefined();
  });
});

describe('mapConversation: pet quick replies', () => {
  it('maps backend pet choices to AI message quick replies', () => {
    const conversation = baseApiConversation([
      {
        uuid: 'm1',
        conversations_uuid: 'conv-1',
        created_at: new Date().toISOString(),
        sender_role: 'ai',
        topic: null,
        body: 'Which pet are you asking about?',
        employees_uuid: null,
        employees_display_name: null,
        pets_uuid: null,
        booking_pets_uuid: null,
        quick_replies: ['Biscuit', 'Sato'],
      },
    ]);

    const result = mapConversation(conversation, new Map());

    expect(result.messages[0].quickReplies).toEqual(['Biscuit', 'Sato']);
  });
});

describe('mapConversation: pet overview cards', () => {
  it('maps structured pet records onto the AI message for card rendering', () => {
    const conversation = baseApiConversation([
      {
        uuid: 'm1',
        conversations_uuid: 'conv-1',
        created_at: new Date().toISOString(),
        sender_role: 'ai',
        topic: 'pet_overview',
        body: 'Pet overview',
        employees_uuid: null,
        employees_display_name: null,
        pets_uuid: null,
        booking_pets_uuid: null,
        pet_cards: [
          {
            profile: { name: 'Biscuit', species: 'dog', breed: null, age: 5, weight: 18 },
            stays: [],
            answer: 'Biscuit gets two meals each day.',
          },
        ],
      },
    ]);

    const result = mapConversation(conversation, new Map());

    expect(result.messages[0].petCards?.[0].profile.name).toBe('Biscuit');
    expect(result.messages[0].petCards?.[0].answer).toBe('Biscuit gets two meals each day.');
  });
});
