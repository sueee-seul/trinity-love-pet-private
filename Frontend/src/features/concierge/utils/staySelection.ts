import type {
  ConciergeCatalogue,
  ConciergeCatalogueItem,
  ConciergeCombo,
  ConciergeNeeds,
  ConciergePetNeed,
  ConciergePetSelection,
  ConciergePlan,
  ConciergeQuote,
  ConciergeSelection,
} from '../types';

/**
 * Pure rules for the stay being built: which combo to follow when new ones arrive, how a hand-built
 * stay survives a change of catalogue or pets, and when an edited stay is a combo again. The store
 * applies these; nothing here prices anything, the server does that.
 */

/** Mirrors the Backend's add-on matching (concierge.quotes.ts): medication is matched by name. */
export const isMedicationAddon = (addon: ConciergeCatalogueItem): boolean =>
  /medication/i.test(addon.name);

/** Add-ons worth showing for this pet: dog-only ones are hidden unless the pet is a dog. */
export const addonsFor = (
  addons: ConciergeCatalogueItem[],
  pet: ConciergePetNeed,
): ConciergeCatalogueItem[] => addons.filter((addon) => !addon.dogOnly || pet.species === 'dog');

/** The server always adds these, so the panel shows them ticked and locked. */
export const isLockedAddon = (addon: ConciergeCatalogueItem, pet: ConciergePetNeed): boolean =>
  addon.compulsory || (pet.needsMedication === true && isMedicationAddon(addon));

const sameIdSet = (a: string[], b: string[]): boolean => {
  const sortedA = [...new Set(a)].sort();
  const sortedB = [...new Set(b)].sort();
  return sortedA.length === sortedB.length && sortedA.every((id, index) => id === sortedB[index]);
};

/** The same stay, whatever order the add-ons were ticked in. */
export const sameSelection = (a: ConciergeSelection, b: ConciergeSelection): boolean =>
  a.pets.length === b.pets.length &&
  a.pets.every((pet, index) => {
    const other = b.pets[index];
    return (
      other !== undefined &&
      pet.roomId === other.roomId &&
      pet.foodId === other.foodId &&
      sameIdSet(pet.addonIds, other.addonIds)
    );
  });

const withPet = (
  selection: ConciergeSelection,
  petIndex: number,
  change: (pet: ConciergePetSelection) => ConciergePetSelection,
): ConciergeSelection => ({
  pets: selection.pets.map((pet, index) => (index === petIndex ? change(pet) : pet)),
});

export const withPetRoom = (
  selection: ConciergeSelection,
  petIndex: number,
  roomId: string,
): ConciergeSelection => withPet(selection, petIndex, (pet) => ({ ...pet, roomId }));

export const withPetFood = (
  selection: ConciergeSelection,
  petIndex: number,
  foodId: string,
): ConciergeSelection => withPet(selection, petIndex, (pet) => ({ ...pet, foodId }));

export const withPetAddonToggled = (
  selection: ConciergeSelection,
  petIndex: number,
  addonId: string,
): ConciergeSelection =>
  withPet(selection, petIndex, (pet) => ({
    ...pet,
    addonIds: pet.addonIds.includes(addonId)
      ? pet.addonIds.filter((id) => id !== addonId)
      : [...pet.addonIds, addonId],
  }));

/** The combo the assistant points at, else the one the server marked, else the first. */
export const recommendedCombo = (
  combos: ConciergeCombo[],
  plan: ConciergePlan | null,
): ConciergeCombo | null =>
  combos.find((combo) => combo.id === plan?.recommendedComboId) ??
  combos.find((combo) => combo.recommended) ??
  combos[0] ??
  null;

/**
 * A hand-built stay carried over to a new catalogue and pet list: every choice that still exists
 * is kept, a missing one takes the recommended combo's choice for that pet, and an add-on a pet
 * cannot have (a walk for a cat) is dropped. The result still needs pricing.
 */
export const mergeSelection = (
  previous: ConciergeSelection | null,
  catalogue: ConciergeCatalogue,
  needs: ConciergeNeeds,
  fallback: ConciergeSelection,
): ConciergeSelection => {
  const roomIds = new Set(catalogue.rooms.map((room) => room.id));
  const foodIds = new Set(catalogue.foods.map((food) => food.id));
  const addonById = new Map(catalogue.addons.map((addon) => [addon.id, addon]));
  return {
    pets: needs.pets.map((pet, index) => {
      const kept = previous?.pets[index];
      const base = fallback.pets[index] ?? { roomId: '', foodId: '', addonIds: [] };
      if (!kept) return base;
      return {
        roomId: roomIds.has(kept.roomId) ? kept.roomId : base.roomId,
        foodId: foodIds.has(kept.foodId) ? kept.foodId : base.foodId,
        addonIds: kept.addonIds.filter((id) => {
          const addon = addonById.get(id);
          return addon !== undefined && (!addon.dogOnly || pet.species === 'dog');
        }),
      };
    }),
  };
};

/** The stay as the store keeps it: what is chosen, its price when known, and where it came from. */
export interface StayChoice {
  selection: ConciergeSelection | null;
  /** Null while the selection still needs the server's price. */
  stayQuote: ConciergeQuote | null;
  appliedComboId: string | null;
  customised: boolean;
}

export const stayFromCombo = (combo: ConciergeCombo): StayChoice => ({
  selection: combo.quote.selection,
  stayQuote: combo.quote,
  appliedComboId: combo.id,
  customised: false,
});

/**
 * The stay after an edit: a combo again when the edit lands on one (its signed quote is reused,
 * no pricing needed), otherwise a custom stay that waits for the server's price.
 */
export const stayAfterEdit = (
  selection: ConciergeSelection,
  combos: ConciergeCombo[],
): StayChoice => {
  const match = combos.find((combo) => sameSelection(combo.quote.selection, selection));
  return match
    ? stayFromCombo(match)
    : { selection, stayQuote: null, appliedComboId: null, customised: true };
};

/**
 * The stay once a chat or checklist turn brings new combos. A guest who has not built their own
 * keeps the combo they applied if it is still offered, else follows the recommendation; "book it
 * for me" always takes the recommendation. A hand-built stay is carried over and priced again.
 */
export const stayAfterTurn = (
  previous: StayChoice,
  combos: ConciergeCombo[],
  catalogue: ConciergeCatalogue,
  needs: ConciergeNeeds,
  plan: ConciergePlan | null,
): StayChoice => {
  const recommended = recommendedCombo(combos, plan);
  if (!recommended) {
    return { ...previous, stayQuote: null, appliedComboId: null };
  }
  if (plan?.bookRequested) return stayFromCombo(recommended);
  if (!previous.customised) {
    return stayFromCombo(
      combos.find((combo) => combo.id === previous.appliedComboId) ?? recommended,
    );
  }
  return stayAfterEdit(
    mergeSelection(previous.selection, catalogue, needs, recommended.quote.selection),
    combos,
  );
};

/**
 * A copied earlier stay ("same as last time") once combos exist for its pets: a combo again when
 * it matches one (its signed quote is reused), otherwise a custom stay that waits for the server's
 * price. Null when the pets no longer match the copy (a pet added or removed in between), so the
 * recommended combo is followed instead.
 */
export const stayFromCopiedSelection = (
  copied: ConciergeSelection,
  combos: ConciergeCombo[],
  catalogue: ConciergeCatalogue,
  needs: ConciergeNeeds,
  plan: ConciergePlan | null,
): StayChoice | null => {
  const recommended = recommendedCombo(combos, plan);
  if (!recommended || copied.pets.length !== needs.pets.length) return null;
  return stayAfterEdit(
    mergeSelection(copied, catalogue, needs, recommended.quote.selection),
    combos,
  );
};
