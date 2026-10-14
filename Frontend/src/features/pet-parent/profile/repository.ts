/**
 * Parent profile store: PostgreSQL only.
 *
 * There is no local fixture and no browser copy of the profile. What these
 * screens show is what the API returned; if the API did not answer, they show
 * the error rather than something that looks like data. `readProfileState()`
 * returning `null` means "not loaded", which is a state the screens render, not
 * one they paper over.
 *
 * Reads stay synchronous. The screens call `readProfileState()` inside render,
 * so a module-level cache is the single source they read, and
 * `hydrateFromServer()` swaps the server's answer into it and notifies
 * subscribers.
 */

import {
  createPetOnServer,
  deletePetOnServer,
  fetchParentProfile,
  saveOwner,
  updatePetOnServer,
  type ParentProfilePayload,
} from './parentProfileApi';
import type { OwnerProfileEditInput, ParentProfileState, Pet, PetFormInput } from './types';

const CHANGE_EVENT = 'wagstay-profile-change';
const SYNC_EVENT = 'wagstay-profile-sync';

export interface ProfileSyncState {
  loading: boolean;
  saving: boolean;
  /** Why the last server call failed, in words a parent can act on. */
  error: string | null;
}

/** `null` until the server has answered. Never a fixture. */
let cache: ParentProfileState | null = null;

let syncState: ProfileSyncState = {
  loading: false,
  saving: false,
  error: null,
};

const notifyChange = (): void => {
  window.dispatchEvent(new Event(CHANGE_EVENT));
};

const setSyncState = (changes: Partial<ProfileSyncState>): void => {
  syncState = { ...syncState, ...changes };
  window.dispatchEvent(new Event(SYNC_EVENT));
};

export function getSyncState(): ProfileSyncState {
  return syncState;
}

export function subscribeSyncState(listener: () => void): () => void {
  const handler = (): void => listener();
  window.addEventListener(SYNC_EVENT, handler);
  return () => window.removeEventListener(SYNC_EVENT, handler);
}

export function readProfileState(): ParentProfileState | null {
  return cache;
}

function writeProfileState(state: ParentProfileState | null): void {
  cache = state;
  notifyChange();
}

export function subscribeProfileState(listener: () => void): () => void {
  const handler = (): void => listener();
  window.addEventListener(CHANGE_EVENT, handler);
  return () => window.removeEventListener(CHANGE_EVENT, handler);
}

/* -------------------------------------------------------------- server sync */

const describeFailure = (error: unknown): string => {
  if (error instanceof TypeError) {
    // A pet parent reads this, so it names their next step, not a developer's.
    return 'We could not reach Wagstay. Check your connection, then reload the page.';
  }
  return error instanceof Error ? error.message : 'The server rejected the request.';
};

const applyPayload = (payload: ParentProfilePayload): void => {
  writeProfileState({ owner: payload.owner, pets: payload.pets });
  setSyncState({ error: null });
};

let hydrated = false;
/**
 * The email `hydrated` was last fetched for. The cache is a page-lifetime
 * singleton, not one scoped to whoever is currently signed in, so switching
 * accounts in the same tab (no full reload) has to be noticed here. Otherwise
 * a second account would keep looking at, and saving over, the first account's
 * owner id.
 */
let hydratedEmail: string | null = null;

/**
 * Pulls the profile from the API once per signed-in account. Safe to call from
 * every mounting screen: repeat calls for the same email after the first are
 * ignored, but a call for a *different* email (a second account signing in
 * without the page reloading) always re-fetches.
 */
export async function hydrateFromServer(email: string): Promise<void> {
  if (hydrated && hydratedEmail === email) {
    return;
  }
  const isAccountSwitch = hydrated && hydratedEmail !== email;
  hydrated = true;
  hydratedEmail = email;

  if (isAccountSwitch) {
    // The cached owner id belongs to whoever was signed in before. Nothing may
    // reuse it while the new account's profile is still loading.
    writeProfileState(null);
  }

  setSyncState({ loading: true, error: null });
  try {
    applyPayload(await fetchParentProfile());
  } catch (error) {
    console.error('Failed to load the parent profile from the server', error);
    setSyncState({ error: describeFailure(error) });
  } finally {
    setSyncState({ loading: false });
  }
}

/** Lets a test or a sign-out force the next mount to fetch again. */
export function resetHydration(): void {
  hydrated = false;
  hydratedEmail = null;
}

/** Drops the signed-out account's profile so the next one cannot see it. */
export function resetProfileState(): void {
  resetHydration();
  writeProfileState(null);
  setSyncState({ loading: false, saving: false, error: null });
}

/**
 * Runs a server write and folds the answer back into the cache.
 *
 * A rejected write is not absorbed into a local copy: the cache still holds
 * what the server last confirmed, the sync state carries the reason, and the
 * error is rethrown so the caller does not act as though the write landed.
 */
const withServerWrite = async (work: () => Promise<ParentProfilePayload>): Promise<void> => {
  setSyncState({ saving: true, error: null });
  try {
    applyPayload(await work());
  } catch (error) {
    console.error('Parent profile write failed', error);
    setSyncState({ error: describeFailure(error) });
    throw error;
  } finally {
    setSyncState({ saving: false });
  }
};

const requireLoaded = (): ParentProfileState => {
  if (!cache) {
    throw new Error('The profile has not loaded yet');
  }
  return cache;
};

/* ------------------------------------------------------------------- writes */

export async function updateOwner(input: OwnerProfileEditInput): Promise<void> {
  const { owner } = requireLoaded();
  await withServerWrite(() =>
    saveOwner(owner.id, {
      ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
      ...(input.avatarFile !== undefined ? { avatarFile: input.avatarFile } : {}),
      ...(input.address !== undefined ? { address: input.address } : {}),
      ...(input.dateOfBirth !== undefined ? { dateOfBirth: input.dateOfBirth } : {}),
      ...(input.emergencyContactNumber !== undefined
        ? { emergencyContactNumber: input.emergencyContactNumber }
        : {}),
    }),
  );
}

/**
 * Resolves to the pet the server created, so the caller can navigate to it.
 *
 * The id belongs to the database, so it is read back out of the server's
 * answer rather than invented here.
 */
export async function createPet(input: PetFormInput): Promise<Pet> {
  const state = requireLoaded();
  const idsBefore = new Set(state.pets.map((pet) => pet.id));

  await withServerWrite(() => createPetOnServer(state.owner.id, input));

  const created = readProfileState()?.pets.find((pet) => !idsBefore.has(pet.id));
  if (!created) {
    throw new Error('The server did not return the new pet');
  }
  return created;
}

export async function updatePet(id: string, input: Partial<PetFormInput>): Promise<void> {
  const current = requireLoaded().pets.find((pet) => pet.id === id);
  if (!current) {
    throw new Error('Pet not found');
  }

  const next = { ...current, ...input };
  const body: PetFormInput = {
    name: next.name,
    species: next.species,
    breed: next.breed,
    photoUrl: next.photoUrl,
    ...(input.photoFile !== undefined ? { photoFile: input.photoFile } : {}),
    birthDate: next.birthDate,
    sex: next.sex,
    desexed: next.desexed,
    weightKg: next.weightKg,
    colour: next.colour,
    microchip: next.microchip,
    dietNotes: next.dietNotes,
    allergies: next.allergies,
    behaviourNotes: next.behaviourNotes,
    vetName: next.vetName,
    vetPhone: next.vetPhone,
    emergencyContact: next.emergencyContact,
  };

  await withServerWrite(() => updatePetOnServer(id, body));
}

export async function deletePet(id: string): Promise<void> {
  await withServerWrite(() => deletePetOnServer(id));
}
