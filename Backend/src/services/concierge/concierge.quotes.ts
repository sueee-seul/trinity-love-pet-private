import { createHash } from 'node:crypto';
import type {
  ConciergeCatalogue,
  ConciergeCatalogueItem,
  ConciergeExtras,
  ConciergeLocale,
  ConciergeNeeds,
  ConciergePetNeed,
  ConciergePetSelection,
  ConciergeQuoteLine,
  ConciergeSelection,
} from '../../contracts/concierge.contract.js';
import type { BookingServiceRecord } from '../../repositories/petparent.booking.repository.js';
import { AppError } from '../../common/middlewares/error.middleware.js';
import { lineTotal, nightsBetween, roundToCents } from '../booking.pricing.js';

/**
 * Prices a stay, deterministically, and suggests combos.
 *
 * This is the only place a concierge price is made. The model can describe a combo but it never
 * computes, adjusts or invents an amount (Fair Trading Act s13 / ACL s48: the advertised price has
 * to be the price). Every line is priced with the shared `lineTotal` rule, the same one the
 * checkout records.
 *
 * A stay is a selection per pet: one room, one food, any add-ons. `priceSelection` prices any
 * selection the guest builds; `buildCombos` offers two or three selections drawn from the stated
 * needs (the simplest, a roomier one, the full one), each named from its contents. Combos are
 * advice, never the only choice. The catalogue has no size metadata yet, so size does not change
 * the price; it is still gathered because staff need it.
 */

export interface UnsignedQuote {
  name: string;
  selection: ConciergeSelection;
  nights: number;
  lines: ConciergeQuoteLine[];
  total: number;
}

export interface UnsignedCombo {
  id: string;
  quote: UnsignedQuote;
  reason: string;
  recommended: boolean;
}

type AddonNeed = 'walks' | 'grooming' | 'playtime' | 'medication' | 'training';

/** Add-ons are matched by name because the catalogue has no machine-readable add-on type. */
const ADDON_NAME_PATTERNS: Record<AddonNeed, RegExp> = {
  walks: /walk/i,
  grooming: /groom|bath|wash|brush/i,
  playtime: /play|social|enrich/i,
  medication: /medication/i,
  training: /train/i,
};

/** Whether a catalogue add-on is the medication handling line, by name. */
export const isMedicationHandling = (name: string): boolean =>
  ADDON_NAME_PATTERNS.medication.test(name);

/** The extras a past stay's add-on names stand for, so a copied stay carries the same needs. */
export const extrasFromServiceNames = (names: string[]): ConciergeExtras => ({
  walks: names.some((name) => ADDON_NAME_PATTERNS.walks.test(name)),
  grooming: names.some((name) => ADDON_NAME_PATTERNS.grooming.test(name)),
  playtime: names.some((name) => ADDON_NAME_PATTERNS.playtime.test(name)),
});

/** Walks and training sessions are for dogs; everything else applies to any pet. */
const DOG_ONLY_ADDONS: ReadonlySet<AddonNeed> = new Set(['walks', 'training']);

/** The three shapes a combo can take; the shape never reaches the guest, the contents do. */
type ComboShape = 'simple' | 'roomier' | 'full';
const COMBO_SHAPES: ComboShape[] = ['simple', 'roomier', 'full'];

const COMBO_REASON: Record<ConciergeLocale, Record<ComboShape, string>> = {
  en: {
    simple: 'Everything you asked for and nothing more: the room, meals and daily care.',
    roomier: 'A roomier suite and house food, which suits a pet on medication or a first stay.',
    full: 'Our best room with every add-on included, so nothing has to be added at the desk.',
  },
  zh: {
    simple: '只包含你需要的：房间、餐食和每日照护，不多不少。',
    roomier: '房间更宽敞并提供店内餐食，适合需要用药或第一次寄养的宠物。',
    full: '最好的房间并包含所有加项，到店后不用再单独加。',
  },
};

interface CatalogueByRole {
  rooms: BookingServiceRecord[];
  foods: BookingServiceRecord[];
  addons: BookingServiceRecord[];
}

const byPrice = (a: BookingServiceRecord, b: BookingServiceRecord): number => a.price - b.price;

const splitCatalogue = (catalogue: BookingServiceRecord[]): CatalogueByRole => {
  const rooms = catalogue.filter((s) => s.category === 'boarding_rate').sort(byPrice);
  const foods = catalogue.filter((s) => s.category === 'food').sort(byPrice);
  const addons = catalogue.filter((s) => s.category === 'addon').sort(byPrice);
  if (rooms.length === 0 || foods.length === 0) {
    // Every stay is a room and food for each pet, so a quote without both would not be a real
    // stay price. This is a facility setup problem, not something the guest can fix.
    throw new AppError(
      'Online quotes are unavailable until boarding rates and food options are set up.',
      'CONCIERGE_CATALOGUE_INCOMPLETE',
      503,
    );
  }
  return { rooms, foods, addons };
};

const addonMatches = (addon: BookingServiceRecord, need: AddonNeed): boolean =>
  ADDON_NAME_PATTERNS[need].test(addon.name);

const isDogOnly = (addon: BookingServiceRecord): boolean =>
  Array.from(DOG_ONLY_ADDONS).some((need) => addonMatches(addon, need));

const suitsPet = (addon: BookingServiceRecord, pet: ConciergePetNeed): boolean =>
  !isDogOnly(addon) || pet.species === 'dog';

const toCatalogueItem = (service: BookingServiceRecord): ConciergeCatalogueItem => ({
  id: service.id,
  name: service.name,
  category: service.category,
  description: service.description ?? null,
  unitPrice: service.price,
  priceUnit: service.priceUnit,
  compulsory: service.compulsory,
  dogOnly: service.category === 'addon' && isDogOnly(service),
});

/** The catalogue as the stay panel lists it, cheapest first within each group. */
export const toCatalogueView = (catalogue: BookingServiceRecord[]): ConciergeCatalogue => {
  const byRole = splitCatalogue(catalogue);
  return {
    rooms: byRole.rooms.map(toCatalogueItem),
    foods: byRole.foods.map(toCatalogueItem),
    addons: byRole.addons.map(toCatalogueItem),
  };
};

const invalidSelection = (detail: string): AppError =>
  new AppError(`This stay cannot be priced: ${detail}`, 'CONCIERGE_SELECTION_INVALID', 422);

const findService = (
  options: BookingServiceRecord[],
  id: string,
  role: string,
): BookingServiceRecord => {
  const found = options.find((service) => service.id === id);
  if (!found) throw invalidSelection(`${role} is not in the catalogue`);
  return found;
};

/**
 * The add-ons a pet's stay carries: what the guest picked, plus anything compulsory and
 * medication handling for a pet that needs it. Medication handling is a safety requirement, not
 * an upsell, so no selection can leave it out.
 */
const resolveAddons = (
  addons: BookingServiceRecord[],
  pet: ConciergePetNeed,
  pickedIds: string[],
): BookingServiceRecord[] => {
  const picked = pickedIds.map((id) => findService(addons, id, 'an add-on'));
  const unsuitable = picked.find((addon) => !suitsPet(addon, pet));
  if (unsuitable) throw invalidSelection(`${unsuitable.name} is for dogs only`);
  const required = addons.filter(
    (addon) => addon.compulsory || (pet.needsMedication && addonMatches(addon, 'medication')),
  );
  const unique = new Map([...required, ...picked].map((addon) => [addon.id, addon]));
  return addons.filter((addon) => unique.has(addon.id));
};

const toLine = (
  service: BookingServiceRecord,
  petIndex: number,
  nights: number,
): ConciergeQuoteLine => ({
  serviceId: service.id,
  name: service.name,
  category: service.category,
  petIndex,
  quantity: 1,
  unitPrice: service.price,
  priceUnit: service.priceUnit,
  lineTotal: roundToCents(lineTotal(service, nights, 1)),
});

const joinNames = (names: string[]): string => {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
};

const petLabel = (pet: ConciergePetNeed | undefined, index: number): string =>
  pet?.name ?? `Pet ${index + 1}`;

/**
 * A name made from the contents, the same in both languages because it is made of catalogue
 * names. Pets with the same choice share one list; otherwise each pet gets its own.
 */
const nameFor = (needs: ConciergeNeeds, lines: ConciergeQuoteLine[]): string => {
  const namesByPet = needs.pets.map((_pet, petIndex) =>
    lines.filter((line) => line.petIndex === petIndex).map((line) => line.name),
  );
  const first = namesByPet[0] ?? [];
  const allSame = namesByPet.every((names) => names.join('|') === first.join('|'));
  if (allSame) return joinNames(first);
  return namesByPet
    .map((names, index) => `${petLabel(needs.pets[index], index)}: ${joinNames(names)}`)
    .join('; ');
};

/** The nights of the stay, or why it cannot be priced. */
const nightsFor = (needs: ConciergeNeeds): number => {
  if (!needs.startDate || !needs.endDate) throw invalidSelection('the dates are missing');
  return nightsBetween(needs.startDate, needs.endDate);
};

/**
 * Prices any selection. Lines come out in the order the panel shows them: room, food, then
 * add-ons cheapest first, pet by pet.
 */
export const priceSelection = (
  needs: ConciergeNeeds,
  selection: ConciergeSelection,
  catalogue: BookingServiceRecord[],
): UnsignedQuote => {
  if (needs.pets.length === 0) throw invalidSelection('there are no pets on the stay');
  if (selection.pets.length !== needs.pets.length) {
    throw invalidSelection('each pet needs a choice of room and food');
  }
  const nights = nightsFor(needs);
  const byRole = splitCatalogue(catalogue);
  const resolved: ConciergePetSelection[] = [];
  const lines = needs.pets.flatMap((pet, petIndex) => {
    const choice = selection.pets[petIndex];
    if (!choice) throw invalidSelection('each pet needs a choice of room and food');
    const room = findService(byRole.rooms, choice.roomId, 'the room');
    const food = findService(byRole.foods, choice.foodId, 'the food');
    const addons = resolveAddons(byRole.addons, pet, choice.addonIds);
    resolved.push({ roomId: room.id, foodId: food.id, addonIds: addons.map((a) => a.id) });
    return [room, food, ...addons].map((service) => toLine(service, petIndex, nights));
  });
  const total = roundToCents(lines.reduce((sum, line) => sum + line.lineTotal, 0));
  return { name: nameFor(needs, lines), selection: { pets: resolved }, nights, lines, total };
};

/** Stable for the same contents, so a recommendation can point at a combo across turns. */
export const comboIdFor = (quote: UnsignedQuote): string => {
  const signature = quote.lines.map((line) => `${line.petIndex}:${line.serviceId}`).join('|');
  return `combo-${createHash('sha1').update(signature).digest('hex').slice(0, 10)}`;
};

const pickForShape = (options: BookingServiceRecord[], shape: ComboShape): BookingServiceRecord => {
  const index =
    shape === 'simple' ? 0 : shape === 'full' ? options.length - 1 : Math.floor(options.length / 2);
  const picked = options[index];
  if (!picked) {
    // `splitCatalogue` guarantees at least one option per role; this guards the invariant.
    throw new Error(`No catalogue option for the ${shape} combo`);
  }
  return picked;
};

const requestedAddonNeeds = (needs: ConciergeNeeds): AddonNeed[] => {
  const requested: AddonNeed[] = [];
  if (needs.extras.walks) requested.push('walks');
  if (needs.extras.grooming) requested.push('grooming');
  if (needs.extras.playtime) requested.push('playtime');
  return requested;
};

const addonsForShape = (
  addons: BookingServiceRecord[],
  needs: ConciergeNeeds,
  pet: ConciergePetNeed,
  shape: ComboShape,
): string[] => {
  const requested = requestedAddonNeeds(needs);
  const chosen = addons.filter((addon) =>
    shape === 'full'
      ? !addonMatches(addon, 'medication')
      : requested.some((need) => addonMatches(addon, need)),
  );
  return chosen.filter((addon) => suitsPet(addon, pet)).map((addon) => addon.id);
};

const selectionForShape = (
  byRole: CatalogueByRole,
  needs: ConciergeNeeds,
  shape: ComboShape,
): ConciergeSelection => ({
  pets: needs.pets.map((pet) => ({
    roomId: pickForShape(byRole.rooms, shape).id,
    foodId: pickForShape(byRole.foods, shape).id,
    addonIds: addonsForShape(byRole.addons, needs, pet, shape),
  })),
});

/**
 * The fit rule both assistants share. Every add-on asked for points at the full stay, which already
 * includes them; medication, a first stay or grooming asks for the roomier suite; the everyday stay
 * is the simplest. The rule is about fit, the panel is about price.
 */
export const recommendShape = (needs: ConciergeNeeds): ComboShape => {
  const { walks, grooming, playtime } = needs.extras;
  if (walks && grooming && playtime) return 'full';
  if (needs.pets.some((pet) => pet.needsMedication || pet.firstTimeBoarding)) return 'roomier';
  if (grooming) return 'roomier';
  return 'simple';
};

/**
 * Builds the combos for needs that are ready to quote. Shapes that come out identical (a small
 * catalogue with one room, say) are collapsed so the guest never compares two copies of the same
 * thing; the recommendation then falls on the first combo left.
 */
export const buildCombos = (
  needs: ConciergeNeeds,
  catalogue: BookingServiceRecord[],
  locale: ConciergeLocale,
): UnsignedCombo[] => {
  if (!needs.startDate || !needs.endDate || needs.pets.length === 0) {
    return [];
  }
  const byRole = splitCatalogue(catalogue);
  const recommendedShape = recommendShape(needs);
  const combos: UnsignedCombo[] = [];
  const seen = new Set<string>();
  for (const shape of COMBO_SHAPES) {
    const quote = priceSelection(needs, selectionForShape(byRole, needs, shape), catalogue);
    const id = comboIdFor(quote);
    if (seen.has(id)) continue;
    seen.add(id);
    combos.push({ id, quote, reason: COMBO_REASON[locale][shape], recommended: false });
    if (shape === recommendedShape) {
      const current = combos[combos.length - 1];
      if (current) current.recommended = true;
    }
  }
  if (!combos.some((combo) => combo.recommended) && combos[0]) {
    combos[0].recommended = true;
  }
  return combos;
};
