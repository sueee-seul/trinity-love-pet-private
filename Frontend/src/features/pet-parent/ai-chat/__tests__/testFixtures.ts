import type { Conversation } from '../types';
import { isoAt } from '../utils';

/**
 * Deterministic conversation fixtures for tests only. Production data now
 * comes from the real conversations/messages API (see conversationApi.ts).
 */
export function createMockConversations(): Conversation[] {
  return [
    {
      id: 'conv-bella-care',
      topic: "Bella's Care Updates",
      topicCategory: 'Feeding',
      petName: 'Bella',
      status: 'Active',
      supportStatus: 'AI Handling',
      startedAt: isoAt(10, 32),
      messages: [
        {
          id: 'msg-1',
          senderRole: 'pet_owner',
          body: 'Has Bella been fed today?',
          timestamp: isoAt(10, 32),
        },
        {
          id: 'msg-2',
          senderRole: 'ai',
          body: "Yes. Bella was fed at 12:30 PM today and ate everything. She's due for her next meal at 5:30 PM.",
          timestamp: isoAt(10, 33),
        },
        {
          id: 'msg-3',
          senderRole: 'pet_owner',
          body: 'Is she still on the same diet plan, or has anything changed recently?',
          timestamp: isoAt(10, 40),
        },
        {
          id: 'msg-4',
          senderRole: 'ai',
          body: "Bella's current diet plan is unchanged. She's on the Grain-Free Chicken formula, 1 cup twice daily, recorded by our care team on Sep 2.",
          timestamp: isoAt(10, 41),
        },
        {
          id: 'msg-5',
          senderRole: 'pet_owner',
          body: "I'd like to speak to someone about changing her diet plan.",
          timestamp: isoAt(10, 45),
        },
      ],
    },
    {
      id: 'conv-luna-booking',
      topic: 'Booking enquiry',
      topicCategory: 'Booking',
      petName: 'Luna',
      status: 'Closed',
      supportStatus: 'Resolved',
      startedAt: isoAt(9, 15, 3),
      supportRequestedAt: isoAt(9, 20, 3),
      supportAgentName: 'John',
      messages: [
        {
          id: 'msg-luna-1',
          senderRole: 'pet_owner',
          body: 'Can I move Luna’s boarding stay from Friday to Saturday?',
          timestamp: isoAt(9, 15, 3),
        },
        {
          id: 'msg-luna-2',
          senderRole: 'ai',
          body: "I can see Luna's current booking. Changing the start date needs a member of our Customer Support team to confirm run availability. Would you like me to bring one in?",
          timestamp: isoAt(9, 16, 3),
        },
        {
          id: 'msg-luna-3',
          senderRole: 'system',
          body: 'Customer Support requested',
          timestamp: isoAt(9, 20, 3),
        },
        {
          id: 'msg-luna-4',
          senderRole: 'system',
          body: 'John from Customer Support joined the conversation',
          timestamp: isoAt(9, 24, 3),
        },
        {
          id: 'msg-luna-5',
          senderRole: 'support',
          authorName: 'John',
          body: "Hi! I've moved Luna's boarding stay to Saturday and confirmed her usual run is available. You're all set.",
          timestamp: isoAt(9, 26, 3),
        },
      ],
    },
    {
      id: 'conv-bella-medication',
      topic: 'Medication question',
      topicCategory: 'Medication',
      petName: 'Bella',
      status: 'Closed',
      supportStatus: 'Resolved',
      startedAt: isoAt(14, 5, 5),
      messages: [
        {
          id: 'msg-med-1',
          senderRole: 'pet_owner',
          body: 'Does Bella need her allergy medication given with food?',
          timestamp: isoAt(14, 5, 5),
        },
        {
          id: 'msg-med-2',
          senderRole: 'ai',
          body: "Yes, Bella's allergy medication is recorded as “give with food,” dosed twice daily. Our care team gives it alongside her regular meals.",
          timestamp: isoAt(14, 6, 5),
        },
      ],
    },
    {
      id: 'conv-general',
      topic: 'General enquiry',
      topicCategory: 'General',
      petName: null,
      status: 'Closed',
      supportStatus: 'Resolved',
      startedAt: isoAt(11, 0, 11),
      messages: [
        {
          id: 'msg-gen-1',
          senderRole: 'pet_owner',
          body: 'What are your daycare drop-off hours on weekends?',
          timestamp: isoAt(11, 0, 11),
        },
        {
          id: 'msg-gen-2',
          senderRole: 'ai',
          body: 'Weekend drop-off is 7:00 AM to 9:30 AM, and pick-up runs until 6:00 PM.',
          timestamp: isoAt(11, 1, 11),
        },
      ],
    },
  ];
}
