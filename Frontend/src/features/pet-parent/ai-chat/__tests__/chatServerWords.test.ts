import { describe, expect, it } from 'vitest';
import { aiReplyText, quickReplyText, stayLabelText, stayStatusText } from '../chatServerWords';

describe('chat server words', () => {
  it('names a stay label in Chinese, within a month and across two', () => {
    expect(stayLabelText('Sep 8-10 (current)', 'zh')).toBe('9月8日至10日（正在住宿）');
    expect(stayLabelText('Sep 28 - Oct 2 (upcoming)', 'zh')).toBe('9月28日至10月2日（已确认）');
    expect(stayLabelText('Oct 12-16 (waiting for review)', 'zh')).toBe(
      '10月12日至16日（等待审核）',
    );
  });

  it('names the fixed quick replies in Chinese and keeps pet names', () => {
    expect(quickReplyText('All stays', 'zh')).toBe('所有住宿');
    expect(quickReplyText('Check my pet status.', 'zh')).toBe('查看我的宠物状态。');
    expect(quickReplyText('Biscuit', 'zh')).toBe('Biscuit');
  });

  it('translates a stay status the server wrote in English', () => {
    expect(stayStatusText('Not accepted', 'zh')).toBe('未被接受');
    expect(stayStatusText('Not accepted', 'en')).toBe('Not accepted');
  });

  it("asks the chat's fixed questions in Chinese", () => {
    expect(aiReplyText('Which pet are you asking about?', 'zh')).toBe('你想问的是哪一只宠物？');
    expect(
      aiReplyText(
        'Which stay are you referring to for Biscuit, or would you like information about all stays? Sep 8-10 (current), Oct 12-16 (waiting for review)',
        'zh',
      ),
    ).toBe(
      '你想问的是 Biscuit 的哪一次住宿，还是想查看所有住宿？9月8日至10日（正在住宿）、10月12日至16日（等待审核）',
    );
    expect(aiReplyText('Which stay are you referring to for Biscuit?', 'zh')).toBe(
      '你想问的是 Biscuit 的哪一次住宿？',
    );
    expect(aiReplyText('Biscuit had a good day.', 'zh')).toBe('Biscuit had a good day.');
  });

  it('leaves English, and anything it does not recognise, as the server wrote it', () => {
    expect(stayLabelText('Sep 8-10 (current)', 'en')).toBe('Sep 8-10 (current)');
    expect(stayLabelText('Next week', 'zh')).toBe('Next week');
  });
});
