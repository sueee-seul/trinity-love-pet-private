import { act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Pet } from '../../pet-parent/types/booking';
import { conciergeApi } from '../api/conciergeApi';
import { useAccountPetsStore } from '../store/accountPets';
import { createEmptyNeeds, useConciergeStore } from '../store/conciergeStore';
import { linkPlanPets, toSavedPetChoice, type PlanPetLinks } from '../store/savedPetLinks';
import type { ConciergeChatResponse, ConciergeNeeds, ConciergePetNeed } from '../types';

vi.mock('../api/conciergeApi', () => ({
  conciergeApi: { chat: vi.fn(), myPets: vi.fn() },
}));

const max: Pet = {
  id: 'pet-max',
  name: 'Max',
  species: 'dog',
  firstTimeBoarding: false,
  needsMedication: true,
};
const luna: Pet = {
  id: 'pet-luna',
  name: 'Luna',
  species: 'cat',
  firstTimeBoarding: null,
  needsMedication: null,
};

const typedPet = (name: string, species: ConciergePetNeed['species']): ConciergePetNeed => ({
  name,
  species,
  size: null,
  needsMedication: null,
  firstTimeBoarding: null,
});

const planWith = (...pets: ConciergePetNeed[]): ConciergeNeeds => ({
  ...createEmptyNeeds(),
  startDate: '2026-12-07',
  endDate: '2026-12-10',
  pets,
});

const link = (needs: ConciergeNeeds, accountPets: Pet[], fillFacts = true): PlanPetLinks =>
  linkPlanPets({ needs, links: [], savedPets: {} }, accountPets.map(toSavedPetChoice), fillFacts);

describe('linking a pet named in the chat to a saved pet', () => {
  it('links the same name and kind, whatever the case or spaces, and brings the saved facts', () => {
    const linked = link(planWith(typedPet(' max ', 'dog')), [max, luna]);

    expect(linked.links).toEqual(['pet-max']);
    expect(linked.savedPets['pet-max']).toEqual({ name: 'Max', species: 'dog' });
    expect(linked.needs.pets[0]).toMatchObject({ needsMedication: true, firstTimeBoarding: false });
  });

  it('never links a different kind of pet or a different name', () => {
    expect(link(planWith(typedPet('Max', 'cat')), [max]).links).toEqual([null]);
    expect(link(planWith(typedPet('Maxi', 'dog')), [max]).links).toEqual([null]);
    expect(link(planWith(typedPet('Max', null)), [max]).links).toEqual([null]);
  });

  it('leaves the choice to the parent when two saved pets share the name and kind', () => {
    const otherMax: Pet = { ...max, id: 'pet-max-2' };

    expect(link(planWith(typedPet('Max', 'dog')), [max, otherMax]).links).toEqual([null]);
  });

  it('links one saved pet to one plan pet only', () => {
    const linked = link(planWith(typedPet('Max', 'dog'), typedPet('Max', 'dog')), [max]);

    expect(linked.links).toEqual(['pet-max', null]);
  });

  it('keeps an answer given in this plan over the saved fact', () => {
    const answered = { ...typedPet('Max', 'dog'), needsMedication: false };

    expect(link(planWith(answered), [max]).needs.pets[0]?.needsMedication).toBe(false);
  });

  it('only links, and changes no fact, once the package was chosen', () => {
    const needs = planWith(typedPet('Max', 'dog'));
    const linked = link(needs, [max], false);

    expect(linked.links).toEqual(['pet-max']);
    expect(linked.needs).toBe(needs);
  });
});

const response = (needs: ConciergeNeeds): ConciergeChatResponse => ({
  reply: 'Here are your options.',
  needs,
  missingFields: [],
  combos: [],
  catalogue: { rooms: [], foods: [], addons: [] },
  assistantMode: 'rules',
  plan: null,
  assistantAvailable: true,
  fullNights: [],
  lastStay: null,
});

describe('the store with the account’s saved pets', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useConciergeStore.getState().reset();
    useAccountPetsStore.setState({ pets: [], status: 'idle' });
    vi.mocked(conciergeApi.chat).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fills what the account knows when a saved pet is tapped, instead of leaving it unknown', () => {
    vi.mocked(conciergeApi.chat).mockImplementation(async (request) => response(request.needs));

    useConciergeStore.getState().applySavedPets([toSavedPetChoice(max)]);

    expect(useConciergeStore.getState().needs.pets[0]).toMatchObject({
      name: 'Max',
      species: 'dog',
      needsMedication: true,
      firstTimeBoarding: false,
    });
  });

  it('links a pet named in the chat and prices what the account knows about it', async () => {
    useAccountPetsStore.setState({ pets: [max], status: 'ready' });
    vi.mocked(conciergeApi.chat)
      .mockResolvedValueOnce(response(planWith(typedPet('max', 'dog'))))
      .mockImplementation(async (request) => response(request.needs));

    await act(async () => {
      await useConciergeStore.getState().sendMessage('Max is coming, 7 to 10 December');
    });

    const state = useConciergeStore.getState();
    expect(state.savedPetLinks).toEqual(['pet-max']);
    expect(state.needs.pets[0]?.needsMedication).toBe(true);
    expect(state.refreshPending).toBe(true);
    useConciergeStore.getState().initDetailsDraft();
    expect(useConciergeStore.getState().detailsDraft?.pets[0]?.existingPetId).toBe('pet-max');
  });

  it('links a pet already named in the chat once the saved pets arrive', () => {
    useConciergeStore.setState({ needs: planWith(typedPet('Luna', 'cat')) });

    useAccountPetsStore.setState({ pets: [max, luna], status: 'ready' });

    expect(useConciergeStore.getState().savedPetLinks).toEqual(['pet-luna']);
  });
});
