import { describe, expect, it } from 'vitest';
import { CHAT_COPY } from '../chatCopy';
import { NEW_CONVERSATION_TOPIC, SUPPORT_REQUESTED_NOTICE, topicFor } from '../conversationText';
import type { Conversation } from '../types';
import { formatDayLabel, isoAt } from '../utils';

const conversation = (overrides: Partial<Conversation>): Conversation => ({
  id: 'conv-1',
  topic: NEW_CONVERSATION_TOPIC,
  topicCategory: 'General',
  petName: null,
  status: 'Active',
  supportStatus: 'AI Handling',
  startedAt: isoAt(10, 0),
  messages: [],
  ...overrides,
});

describe('CHAT_COPY topic', () => {
  it('keeps every English title exactly as stored', () => {
    const stored = conversation({ topic: topicFor('Bella', 'Feeding'), petName: 'Bella' });
    expect(CHAT_COPY.en.topic(stored)).toBe('Bella - Feeding');
    expect(CHAT_COPY.en.topic(conversation({}))).toBe('New conversation');
  });

  it('writes the titles the chat built in Chinese', () => {
    expect(CHAT_COPY.zh.topic(conversation({}))).toBe('新对话');
    expect(
      CHAT_COPY.zh.topic(
        conversation({
          topic: topicFor('Bella', 'Feeding'),
          topicCategory: 'Feeding',
          petName: 'Bella',
        }),
      ),
    ).toBe('Bella · 喂食');
    expect(
      CHAT_COPY.zh.topic(
        conversation({ topic: topicFor(null, 'Booking'), topicCategory: 'Booking' }),
      ),
    ).toBe('预约咨询');
  });

  it('shows a title it did not build as delivered', () => {
    expect(CHAT_COPY.zh.topic(conversation({ topic: "Bella's Care Updates" }))).toBe(
      "Bella's Care Updates",
    );
  });
});

describe('CHAT_COPY systemNotice', () => {
  it('translates only the line the chat adds itself', () => {
    expect(CHAT_COPY.zh.systemNotice(SUPPORT_REQUESTED_NOTICE)).toBe('已请求客服');
    expect(CHAT_COPY.zh.systemNotice('Conversation resolved')).toBe('Conversation resolved');
    expect(CHAT_COPY.en.systemNotice(SUPPORT_REQUESTED_NOTICE)).toBe('Customer Support requested');
  });
});

describe('formatDayLabel in Chinese', () => {
  it('says today in Chinese', () => {
    expect(formatDayLabel(isoAt(10, 0), 'zh')).toBe('今天');
  });
});
