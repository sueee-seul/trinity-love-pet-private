import { describe, expect, it } from 'vitest';
import type { ComboDescription } from '../services/concierge/concierge.assistant.js';
import {
  buildPlan,
  recommendedCombo,
  wantsAssistantToBook,
} from '../services/concierge/concierge.plan.js';

const combos: ComboDescription[] = [
  {
    id: 'combo-simple',
    name: 'Cosy room and House food',
    includesByPet: [['Cosy room', 'House food']],
    reason: 'Everything you asked for and nothing more.',
    recommended: false,
  },
  {
    id: 'combo-roomier',
    name: 'Garden suite and Premium food',
    includesByPet: [['Garden suite', 'Premium food']],
    reason: '房间更宽敞，适合第一次寄养的宠物。',
    recommended: true,
  },
];

describe('recommendedCombo', () => {
  it('returns the combo the house rule marked, or the first one, or none', () => {
    expect(recommendedCombo(combos)?.id).toBe('combo-roomier');
    expect(recommendedCombo(combos.map((combo) => ({ ...combo, recommended: false })))?.id).toBe(
      'combo-simple',
    );
    expect(recommendedCombo([])).toBeNull();
  });
});

describe('wantsAssistantToBook', () => {
  it('hears the hand-off in both languages and not an ordinary question', () => {
    for (const text of [
      'Book it for me',
      'ok go ahead and book',
      '帮我订吧',
      '就订这个',
      '直接预订',
    ]) {
      expect(wantsAssistantToBook(text)).toBe(true);
    }
    for (const text of ['How do I book?', 'what does the booking cost', '预订要多少钱']) {
      expect(wantsAssistantToBook(text)).toBe(false);
    }
  });
});

describe('buildPlan', () => {
  it('points at the recommended combo with its reason and carries the notes into the form', () => {
    const plan = buildPlan({
      combos,
      locale: 'zh',
      bookRequested: true,
      notes: 'Scared of thunder.',
    });
    expect(plan).toEqual({
      recommendedComboId: 'combo-roomier',
      reason: '房间更宽敞，适合第一次寄养的宠物。',
      bookRequested: true,
      prefill: { careNotes: 'Scared of thunder.' },
    });
  });

  it('has no prefill when there is nothing to carry, and no pick without combos', () => {
    const plan = buildPlan({ combos: [], locale: 'en', bookRequested: false, notes: '' });
    expect(plan).toEqual({
      recommendedComboId: null,
      reason: null,
      bookRequested: false,
      prefill: null,
    });
  });
});
