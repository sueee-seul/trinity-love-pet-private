import { describe, expect, it } from 'vitest';
import { guardReply, MAX_REPLY_LENGTH } from '../services/concierge/concierge.reply-guard.js';

const EN_POINTER = 'You can see the exact price on the package cards.';
const ZH_POINTER = '具体价格以套餐卡片为准。';

describe('guardReply', () => {
  it.each([
    'The Royal suite is $85 a night.',
    'That comes to NZ$ 1,020.50 in total.',
    'Only NZD 300 for the week.',
    'It is 120 dollars cheaper.',
    'The suite is 85 a night.',
    'Around 85 per night.',
    'That is 129 NZ dollars.',
    '€85 or £85.',
    'It is 85.00 total.',
    'Just 85/night.',
    'Roughly one hundred dollars.',
    'Save 20% with Comfort.',
    'Comfort is the best value option.',
    'NZ$1.2k for the fortnight.',
  ])('replaces the money sentence in "%s"', (text) => {
    expect(guardReply(text, 'en')).toBe(EN_POINTER);
  });

  it.each([
    '豪华套房一晚 85 纽币。',
    '人民币 85。',
    '一晚85刀。',
    '一晚八十五元。',
    '舒适套餐最划算。',
    '现在有优惠。',
  ])('replaces the money sentence in "%s"', (text) => {
    expect(guardReply(text, 'zh')).toBe(ZH_POINTER);
  });

  it('keeps the other sentences and adds the pointer once', () => {
    const guarded = guardReply(
      'Lovely, two dogs from 12 to 15 October. The Royal suite is $85 a night. Signature is cheapest overall. Choose one below.',
      'en',
    );

    expect(guarded).toBe(`Lovely, two dogs from 12 to 15 October. ${EN_POINTER} Choose one below.`);
  });

  it('keeps dates, nights and pet counts', () => {
    const text = 'Two dogs from 2026-10-12 to 15/10, that is 3 nights.';

    expect(guardReply(text, 'en')).toBe(text);
  });

  it('keeps Chinese dates and counts', () => {
    const text = '好的，两只猫，10月12日到15日，一共3晚。';

    expect(guardReply(text, 'zh')).toBe(text);
  });

  it('replaces model dashes with plain punctuation', () => {
    expect(guardReply('Lovely \u2014 two dogs from 12\u201315 October.', 'en')).toBe(
      'Lovely, two dogs from 12 to 15 October.',
    );
    expect(guardReply('好的\u2014\u2014两只猫，10月12日\u201415日。', 'zh')).toBe(
      '好的，两只猫，10月12日至15日。',
    );
  });

  it('uses Chinese punctuation when the guest writes Chinese on the English page', () => {
    expect(guardReply('好的\u2014\u2014我们开始吧。', 'en')).toBe('好的，我们开始吧。');
  });

  it('still catches a price range once its dash is gone', () => {
    expect(guardReply('It is $85\u2013$120 a night.', 'en')).toBe(EN_POINTER);
  });

  it('caps runaway replies', () => {
    const guarded = guardReply('a'.repeat(MAX_REPLY_LENGTH + 500), 'en');

    expect(guarded.length).toBe(MAX_REPLY_LENGTH);
    expect(guarded.endsWith('…')).toBe(true);
  });

  it('keeps line breaks and list markers, so the page can show the list', () => {
    const text =
      'I recommend the **Deluxe suite** combo:\n- **Deluxe suite:** more room\n- Outdoor walk\n\nOpen your stay to change any line.';

    expect(guardReply(text, 'en')).toBe(text);
  });

  it('points to the price once inside a list and drops later money lines', () => {
    const guarded = guardReply(
      'Your combo:\n- Deluxe suite, $75 a night\n- Outdoor walk, $15 per walk\n- House food',
      'en',
    );

    expect(guarded).toBe(`Your combo:\n- ${EN_POINTER}\n- House food`);
  });
});
