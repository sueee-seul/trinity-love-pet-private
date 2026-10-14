import type { ConciergeSpecies } from '../types';

/** Saved species are free text in the database; anything unrecognised is "other", never a guess. */
export const normaliseSpecies = (species: string | undefined): ConciergeSpecies => {
  const text = (species ?? '').trim().toLowerCase();
  if (/dog|pupp|canine|犬|狗/.test(text)) return 'dog';
  if (/cat|kitt|feline|猫/.test(text)) return 'cat';
  return 'other';
};
