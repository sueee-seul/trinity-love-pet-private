import { describe, expect, it } from 'vitest';
import { STAY_CHANGES_COPY } from '../stayChangesCopy';

describe('the cancel and change-dates wording', () => {
  it('names the fee tier, one night per pet or half of each stay', () => {
    const { en, zh } = STAY_CHANGES_COPY;
    expect(en.cancel.costWithFee('$120.00', false)).toContain('one night for each confirmed pet');
    expect(en.cancel.costWithFee('$230.00', true)).toContain('half of each confirmed pet’s stay');
    expect(zh.cancel.costWithFee('$120.00', false)).toContain('每只已确认宠物一晚的费用');
    expect(zh.cancel.costWithFee('$230.00', true)).toContain('住宿费用的一半');
  });

  it('never promises a free window the current terms do not have', () => {
    const { en, zh } = STAY_CHANGES_COPY;
    expect(en.cancel.freeEarly).toBe('Cancelling now is free. Nothing is charged.');
    expect(en.cancel.freeEarly).not.toMatch(/72 hours/);
    expect(zh.cancel.freeEarly).not.toMatch(/72/);
  });

  it('says "once" only for an older booking with its one free change', () => {
    const { en, zh } = STAY_CHANGES_COPY;
    expect(en.move.intro('Biscuit', true)).toContain('You can do this once');
    expect(en.move.intro('Biscuit', false)).toContain('as often as you need before check-in');
    expect(zh.move.intro('Biscuit', false)).toContain('次数不限');
  });
});
