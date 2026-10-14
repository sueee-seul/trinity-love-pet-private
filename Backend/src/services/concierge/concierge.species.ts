import type { ConciergeSpecies } from '../../contracts/concierge.contract.js';

/**
 * Saved pets store species as free text ("Dog", "canine", "猫"). Only a clear dog or cat counts;
 * anything else is unknown, so a saved pet is refused only when it is clearly the other kind.
 */
export const readSavedSpecies = (species: string | null | undefined): ConciergeSpecies | null => {
  const text = (species ?? '').trim().toLowerCase();
  if (/dog|pupp|canine|犬|狗/.test(text)) return 'dog';
  if (/cat|kitt|feline|猫/.test(text)) return 'cat';
  return null;
};
