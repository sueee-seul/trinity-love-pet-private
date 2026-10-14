import { describe, expect, it } from 'vitest';
import type { ConciergeSelection } from '../contracts/concierge.contract.js';
import {
  buildCombos,
  comboIdFor,
  priceSelection,
  recommendShape,
  toCatalogueView,
} from '../services/concierge/concierge.quotes.js';
import { CATALOGUE, readyNeeds } from './fixtures/concierge.fixtures.js';

const namesFor = (lines: { name: string }[]): string[] => lines.map((line) => line.name);

const idOf = (name: string): string => {
  const service = CATALOGUE.find((entry) => entry.name === name);
  if (!service) throw new Error(`Fixture service ${name} is missing`);
  return service.id;
};

const selectionOf = (room: string, food: string, addons: string[] = []): ConciergeSelection => ({
  pets: [{ roomId: idOf(room), foodId: idOf(food), addonIds: addons.map(idOf) }],
});

describe('priceSelection', () => {
  it('prices any selection as the sum of its lines with the shared rule', () => {
    const quote = priceSelection(
      readyNeeds(),
      selectionOf('Garden suite', 'Premium food', ['Farewell bath']),
      CATALOGUE,
    );

    // 3 nights: Garden 60x3 + premium food 8x3 + bath 35 once.
    expect(quote.nights).toBe(3);
    expect(namesFor(quote.lines)).toEqual(['Garden suite', 'Premium food', 'Farewell bath']);
    expect(quote.total).toBe(180 + 24 + 35);
    expect(quote.name).toBe('Garden suite, Premium food and Farewell bath');
  });

  it('refuses a room or food that is not in the catalogue, and a pet without a choice', () => {
    expect(() =>
      priceSelection(
        readyNeeds(),
        { pets: [{ roomId: idOf('Premium food'), foodId: idOf('House food'), addonIds: [] }] },
        CATALOGUE,
      ),
    ).toThrow(/room is not in the catalogue/);
    expect(() => priceSelection(readyNeeds(), { pets: [] }, CATALOGUE)).toThrow(
      /each pet needs a choice/,
    );
  });

  it('always carries medication handling for a pet that needs it', () => {
    const quote = priceSelection(
      readyNeeds({
        pets: [{ species: 'cat', size: null, needsMedication: true, firstTimeBoarding: null }],
      }),
      selectionOf('Cosy room', 'House food'),
      CATALOGUE,
    );

    expect(namesFor(quote.lines)).toContain('Medication administration');
    expect(quote.selection.pets[0]?.addonIds).toContain(idOf('Medication administration'));
  });

  it('refuses a walk for a cat', () => {
    expect(() =>
      priceSelection(
        readyNeeds({
          pets: [{ species: 'cat', size: null, needsMedication: false, firstTimeBoarding: null }],
        }),
        selectionOf('Cosy room', 'House food', ['Daily walk']),
        CATALOGUE,
      ),
    ).toThrow(/for dogs only/);
  });

  it('names a stay per pet when the pets choose differently', () => {
    const quote = priceSelection(
      readyNeeds({
        pets: [
          { species: 'dog', size: 'small', needsMedication: false, firstTimeBoarding: null },
          {
            name: 'Mochi',
            species: 'cat',
            size: null,
            needsMedication: false,
            firstTimeBoarding: null,
          },
        ],
      }),
      {
        pets: [
          { roomId: idOf('Cosy room'), foodId: idOf('House food'), addonIds: [] },
          { roomId: idOf('Royal suite'), foodId: idOf('Premium food'), addonIds: [] },
        ],
      },
      CATALOGUE,
    );

    expect(quote.name).toBe('Pet 1: Cosy room and House food; Mochi: Royal suite and Premium food');
    expect(quote.lines.map((line) => line.petIndex)).toEqual([0, 0, 1, 1]);
    expect(quote.total).toBe(135 + 255 + 24);
  });

  it('refuses to quote without boarding rates or food in the catalogue', () => {
    const noFood = CATALOGUE.filter((s) => s.category !== 'food');

    expect(() =>
      priceSelection(readyNeeds(), selectionOf('Cosy room', 'House food'), noFood),
    ).toThrow(/Online quotes are unavailable/);
  });
});

describe('buildCombos', () => {
  it('builds the simplest, a roomier and the full stay, named from their contents', () => {
    const [simple, roomier, full] = buildCombos(readyNeeds(), CATALOGUE, 'en');

    // 3 nights: Cosy 45x3 + house food 0.
    expect(simple?.quote.name).toBe('Cosy room and House food');
    expect(simple?.quote.total).toBe(135);
    // Garden 60x3 + premium food 8x3; nothing extra was asked for.
    expect(roomier?.quote.total).toBe(204);
    // Royal 85x3 + premium food 8x3 + walk 15x3 + bath 35 + playtime 10x3.
    expect(full?.quote.total).toBe(255 + 24 + 45 + 35 + 30);
    expect(full?.quote.name).toBe(
      'Royal suite, Premium food, Group playtime, Daily walk and Farewell bath',
    );
  });

  it('marks exactly one combo recommended and explains each in the guest language', () => {
    const combos = buildCombos(readyNeeds(), CATALOGUE, 'zh');

    // A first stay points at the roomier suite.
    expect(combos.map((combo) => combo.recommended)).toEqual([false, true, false]);
    for (const combo of combos) {
      expect(combo.reason).toMatch(/[㐀-鿿]/);
      expect(combo.reason).not.toMatch(/\$|\d/);
    }
  });

  it('puts requested extras into every combo', () => {
    const combos = buildCombos(
      readyNeeds({ extras: { walks: true, grooming: false, playtime: false } }),
      CATALOGUE,
      'en',
    );

    for (const combo of combos) {
      expect(namesFor(combo.quote.lines)).toContain('Daily walk');
    }
  });

  it('never offers walks to a cat', () => {
    const combos = buildCombos(
      readyNeeds({
        pets: [{ species: 'cat', size: null, needsMedication: false, firstTimeBoarding: null }],
        extras: { walks: true, grooming: true, playtime: true },
      }),
      CATALOGUE,
      'en',
    );

    for (const combo of combos) {
      expect(namesFor(combo.quote.lines)).not.toContain('Daily walk');
    }
  });

  it('collapses combos that would be identical and keeps the ids stable', () => {
    const tiny = CATALOGUE.filter((s) => ['Cosy room', 'House food'].includes(s.name));
    const combos = buildCombos(readyNeeds(), tiny, 'en');

    expect(combos).toHaveLength(1);
    expect(combos[0]?.recommended).toBe(true);
    const only = combos[0];
    expect(only && comboIdFor(only.quote)).toBe(only?.id);
    expect(buildCombos(readyNeeds(), tiny, 'zh')[0]?.id).toBe(combos[0]?.id);
  });
});

describe('recommendShape', () => {
  it('fits an everyday stay to the simplest combo', () => {
    expect(
      recommendShape(
        readyNeeds({
          pets: [
            { species: 'dog', size: 'large', needsMedication: false, firstTimeBoarding: false },
          ],
        }),
      ),
    ).toBe('simple');
  });

  it('fits medication, a first stay or grooming to the roomier combo', () => {
    expect(recommendShape(readyNeeds())).toBe('roomier');
    expect(
      recommendShape(
        readyNeeds({
          pets: [{ species: 'cat', size: null, needsMedication: true, firstTimeBoarding: false }],
        }),
      ),
    ).toBe('roomier');
    expect(
      recommendShape(
        readyNeeds({
          pets: [
            { species: 'dog', size: 'small', needsMedication: false, firstTimeBoarding: false },
          ],
          extras: { walks: false, grooming: true, playtime: false },
        }),
      ),
    ).toBe('roomier');
  });

  it('fits every add-on asked for to the full combo, which includes them', () => {
    expect(
      recommendShape(readyNeeds({ extras: { walks: true, grooming: true, playtime: true } })),
    ).toBe('full');
  });
});

describe('toCatalogueView', () => {
  it('groups the catalogue cheapest first and flags dog-only add-ons', () => {
    const view = toCatalogueView(CATALOGUE);

    expect(view.rooms.map((room) => room.name)).toEqual([
      'Cosy room',
      'Garden suite',
      'Royal suite',
    ]);
    expect(view.foods.map((food) => food.unitPrice)).toEqual([0, 8]);
    expect(view.addons.find((addon) => addon.name === 'Daily walk')?.dogOnly).toBe(true);
    expect(view.addons.find((addon) => addon.name === 'Farewell bath')?.dogOnly).toBe(false);
  });
});

describe('the training session add-on', () => {
  const withTraining = [
    ...CATALOGUE,
    {
      id: '11111111-1111-4111-8111-0000000000aa',
      name: 'Training Session',
      category: 'addon' as const,
      price: 35,
      priceUnit: 'per session',
      compulsory: false,
    },
  ];

  it('is for dogs only, so a cat is never offered or sold one', () => {
    const view = toCatalogueView(withTraining);
    expect(view.addons.find((addon) => addon.name === 'Training Session')?.dogOnly).toBe(true);

    const cat = readyNeeds({
      pets: [{ species: 'cat', size: null, needsMedication: false, firstTimeBoarding: false }],
    });
    const combos = buildCombos(cat, withTraining, 'en');
    const lines = combos.flatMap((combo) => combo.quote.lines.map((line) => line.name));
    expect(lines).not.toContain('Training Session');
  });
});
