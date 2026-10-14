import type { Pet } from '../../pet-parent/types/booking';
import type { ConciergeNeeds, ConciergePetNeed, ConciergeSpecies } from '../types';
import { emptyPet } from '../utils/needsEdit';
import { normaliseSpecies } from '../utils/species';
import type { SavedPetInfo } from './persistence';

/**
 * How the plan's pets are tied to the pets saved on the parent's account. A linked pet is booked
 * as that saved pet at checkout (by its id), so it is never created twice, and what the account
 * already knows about it is not asked again. Pure, so every rule is tested without the store.
 */

/** The Backend's limit for a pet's name in the needs. */
export const MAX_PET_NAME_LENGTH = 60;

/** A saved pet as the plan uses it: who it is, and what the account already knows about it. */
export interface SavedPetChoice {
  id: string;
  name: string;
  species: ConciergeSpecies;
  firstTimeBoarding: false | null;
  needsMedication: true | null;
}

export const toSavedPetChoice = (pet: Pet): SavedPetChoice => ({
  id: pet.id,
  name: pet.name,
  species: normaliseSpecies(pet.species),
  firstTimeBoarding: pet.firstTimeBoarding,
  needsMedication: pet.needsMedication,
});

/** The account's pets with these ids, in this order; an id no longer on the account is left out. */
export const savedPetChoices = (ids: string[], accountPets: Pet[]): SavedPetChoice[] =>
  ids.flatMap((id) => {
    const pet = accountPets.find((candidate) => candidate.id === id);
    return pet ? [toSavedPetChoice(pet)] : [];
  });

/** A plan pet for a chosen saved pet, carrying what the account already knows about it. */
export const petNeedFor = (saved: SavedPetChoice): ConciergePetNeed => ({
  ...emptyPet(saved.species),
  name: saved.name.slice(0, MAX_PET_NAME_LENGTH),
  needsMedication: saved.needsMedication,
  firstTimeBoarding: saved.firstTimeBoarding,
});

/** "max " typed in the chat is the saved "Max": case and the spaces around it do not count. */
export const samePetName = (typed: string, saved: string): boolean =>
  typed.trim().toLowerCase() === saved.slice(0, MAX_PET_NAME_LENGTH).trim().toLowerCase();

/**
 * A link is only kept while the pet at that position is still that saved pet (same species, and
 * the same name if a name is known). Otherwise a changed plan could book the wrong saved pet on
 * lines priced for another.
 */
const reconcileLinks = (
  needs: ConciergeNeeds,
  links: Array<string | null>,
  savedPets: Record<string, SavedPetInfo>,
): Array<string | null> =>
  needs.pets.map((pet, index) => {
    const link = links[index] ?? null;
    const saved = link ? savedPets[link] : undefined;
    if (!link || !saved || pet.species !== saved.species) return null;
    return !pet.name || samePetName(pet.name, saved.name) ? link : null;
  });

/**
 * A pet described in the chat with the same name and kind as exactly one saved pet is that saved
 * pet. Two saved pets that share a name and kind are left for the parent to pick on the details
 * step, and a saved pet already linked elsewhere in the plan is never linked twice.
 */
const linkTypedPets = (
  needs: ConciergeNeeds,
  links: Array<string | null>,
  accountPets: SavedPetChoice[],
): Array<string | null> => {
  const taken = new Set(links.filter((link): link is string => link !== null));
  return needs.pets.map((pet, index) => {
    const link = links[index] ?? null;
    const name = pet.name?.trim();
    if (link !== null || !name || pet.species === null) return link;
    const matches = accountPets.filter(
      (saved) =>
        !taken.has(saved.id) && saved.species === pet.species && samePetName(name, saved.name),
    );
    const [only] = matches;
    if (matches.length !== 1 || !only) return null;
    taken.add(only.id);
    return only.id;
  });
};

/** Fills only the facts nobody has answered in this plan: an answer given here always wins. */
const withSavedFacts = (
  needs: ConciergeNeeds,
  links: Array<string | null>,
  accountPets: SavedPetChoice[],
): ConciergeNeeds => {
  const byId = new Map(accountPets.map((saved) => [saved.id, saved]));
  const pets = needs.pets.map((pet, index) => {
    const link = links[index];
    const saved = link ? byId.get(link) : undefined;
    if (!saved) return pet;
    const needsMedication = pet.needsMedication ?? saved.needsMedication;
    const firstTimeBoarding = pet.firstTimeBoarding ?? saved.firstTimeBoarding;
    return needsMedication === pet.needsMedication && firstTimeBoarding === pet.firstTimeBoarding
      ? pet
      : { ...pet, needsMedication, firstTimeBoarding };
  });
  return pets.every((pet, index) => pet === needs.pets[index]) ? needs : { ...needs, pets };
};

export interface PlanPetLinks {
  needs: ConciergeNeeds;
  /** Saved pet ids for each position in needs.pets. */
  links: Array<string | null>;
  /** What each linked saved pet is, so a link is dropped when its position changes pet. */
  savedPets: Record<string, SavedPetInfo>;
}

/**
 * The plan's links after the needs or the account's pets changed. The facts are filled only
 * while the plan can still change (`fillFacts`): after the parent continued with a stay, the agreed
 * plan is what gets booked, so only the links follow.
 */
export const linkPlanPets = (
  plan: PlanPetLinks,
  accountPets: SavedPetChoice[],
  fillFacts: boolean,
): PlanPetLinks => {
  const links = linkTypedPets(
    plan.needs,
    reconcileLinks(plan.needs, plan.links, plan.savedPets),
    accountPets,
  );
  const newlyKnown = accountPets.filter(
    (saved) => links.includes(saved.id) && !plan.savedPets[saved.id],
  );
  const savedPets =
    newlyKnown.length === 0
      ? plan.savedPets
      : {
          ...plan.savedPets,
          ...Object.fromEntries(
            newlyKnown.map((saved) => [saved.id, { name: saved.name, species: saved.species }]),
          ),
        };
  return {
    needs: fillFacts ? withSavedFacts(plan.needs, links, accountPets) : plan.needs,
    links,
    savedPets,
  };
};
