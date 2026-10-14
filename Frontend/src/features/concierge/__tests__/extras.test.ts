import { describe, expect, it } from 'vitest';
import { CONCIERGE_COPY } from '../copy';
import { createEmptyNeeds } from '../store/conciergeStore';
import type { ConciergeNeeds, ConciergePetNeed } from '../types';
import { chosenExtraLabels } from '../utils/extras';
import { stayAtAGlance } from '../utils/planSummary';

const pet = (species: ConciergePetNeed['species']): ConciergePetNeed => ({
  species,
  size: null,
  needsMedication: false,
  firstTimeBoarding: null,
});

describe('chosenExtraLabels', () => {
  it('names the extras the guest asked for, in page order and in the page language', () => {
    const extras = { walks: true, grooming: false, playtime: true };
    expect(chosenExtraLabels(CONCIERGE_COPY.en, extras)).toEqual(['Daily walks', 'Group playtime']);
    expect(chosenExtraLabels(CONCIERGE_COPY.zh, extras)).toEqual(['每天遛狗', '集体玩耍']);
  });
});

describe('stayAtAGlance', () => {
  const stay: ConciergeNeeds = {
    ...createEmptyNeeds(),
    startDate: '2026-10-12',
    endDate: '2026-10-15',
    pets: [pet('dog'), pet('cat')],
  };

  it('says the dates, nights and pets in one line, in both languages', () => {
    expect(stayAtAGlance(CONCIERGE_COPY.en, 'en', stay)).toMatch(/ · 3 nights · 2 pets$/);
    expect(stayAtAGlance(CONCIERGE_COPY.zh, 'zh', stay)).toMatch(/ · 3 晚 · 2 只宠物$/);
  });

  it('leaves out dates that cannot be quoted, and is empty with nothing known', () => {
    expect(stayAtAGlance(CONCIERGE_COPY.en, 'en', { ...stay, endDate: stay.startDate })).toBe(
      '2 pets',
    );
    expect(stayAtAGlance(CONCIERGE_COPY.en, 'en', createEmptyNeeds())).toBeNull();
  });

  it('says one pet in the singular', () => {
    expect(stayAtAGlance(CONCIERGE_COPY.en, 'en', { ...stay, pets: [pet('dog')] })).toMatch(
      / · 1 pet$/,
    );
  });
});
