import { create } from 'zustand';
import { useAuthStore } from '../../../shared/auth/store/authStore';
import { conciergeApi } from '../api/conciergeApi';
import { CONCIERGE_COPY, type GreetingMode, type LocalisedText } from '../copy';
import {
  CONCIERGE_MAX_PETS,
  type ConciergeAcceptQuoteResponse,
  type ConciergeAssistantMode,
  type ConciergeCatalogue,
  type ConciergeChatMessage,
  type ConciergeChatResponse,
  type ConciergeCheckoutResponse,
  type ConciergeCombo,
  type ConciergeLastStay,
  type ConciergeLocale,
  type ConciergeNeedField,
  type ConciergeNeeds,
  type ConciergePlan,
  type ConciergePlanPrefill,
  type ConciergeQuote,
  type ConciergeSelection,
  type ConciergeStep,
  type ConciergeTurnTrigger,
  type ConciergeUiMessage,
} from '../types';
import { describeConciergeError } from '../utils/conciergeErrors';
import { formatNzd } from '../utils/format';
import { linksFromLastStay } from '../utils/lastStay';
import { stayNameText } from '../utils/stayName';
import {
  stayAfterEdit,
  stayAfterTurn,
  stayFromCombo,
  stayFromCopiedSelection,
  withPetAddonToggled,
  withPetFood,
  withPetRoom,
  type StayChoice,
} from '../utils/staySelection';
import type { DetailsDraft } from '../utils/validateDetails';
import { useAccountPetsStore } from './accountPets';
import {
  clearSnapshot,
  loadSnapshot,
  saveSnapshot,
  SNAPSHOT_VERSION,
  VERIFICATION_USABLE_MS,
  type BookedStay,
  type ConciergeSnapshot,
  type SavedPetInfo,
} from './persistence';
import {
  linkPlanPets,
  petNeedFor,
  toSavedPetChoice,
  type PlanPetLinks,
  type SavedPetChoice,
} from './savedPetLinks';

/**
 * One booking conversation: chat, answer buttons, the stay card and the stay panel share this
 * store, so none of them can disagree about what has been decided.
 *
 * The server is the authority for what is missing and for every price. The store keeps the latest
 * answer and remembers which needs the combos were priced for: if the needs have moved on since
 * (a tick whose re-price failed, a reload mid-refresh), the combos are stale and cannot be
 * agreed to. A sequence number makes sure a slow, older answer never overwrites a newer one.
 *
 * The stay itself is a selection per pet. Applying a combo takes its signed quote as it is; any
 * edit prices the new selection through `/price`, a run of ticks batched into one request, and the
 * last answer only. Progress survives a reload in this tab (see persistence.ts).
 */

/** Checklist edits are batched so a run of ticks costs one request, not one per tick. */
export const CHECKLIST_REFRESH_DELAY_MS = 400;
/** Stay panel edits are batched the same way, a little tighter so the total follows the tick. */
export const PRICE_REFRESH_DELAY_MS = 300;
/** The Backend accepts at most this many messages; older ones are dropped from the request. */
const MAX_HISTORY_MESSAGES = 30;
/** The Backend refuses longer messages, so nothing longer is ever kept in the history. */
export const MAX_MESSAGE_LENGTH = 2000;
/** Message turns in a row that changed nothing before the page offers the checklist or a person. */
export const MISSES_BEFORE_HELP = 2;

const LOCALE_KEY = 'trinity-concierge-locale';
const DEFAULT_DROP_OFF = '09:00';
const DEFAULT_PICK_UP = '17:00';

/** /book is for boarding stays (the only service bookable online), so that is known up front. */
export const createEmptyNeeds = (): ConciergeNeeds => ({
  service: 'boarding',
  startDate: null,
  endDate: null,
  pets: [],
  extras: { walks: false, grooming: false, playtime: false },
  notes: '',
});

export const sameNeeds = (a: ConciergeNeeds | null, b: ConciergeNeeds | null): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

type TurnStatus = 'idle' | 'sending' | 'error';
type PricingStatus = 'idle' | 'pricing' | 'error';

/**
 * What opened the stay panel. The panel moves the keyboard into itself except when the guest has
 * just clicked into the chat box: taking the cursor away from the box they chose would be a trap.
 */
export type StayPanelOpener = 'button' | 'composer' | 'combos';

export interface ConciergeData {
  locale: ConciergeLocale;
  step: ConciergeStep;
  messages: ConciergeUiMessage[];
  needs: ConciergeNeeds;
  missingFields: ConciergeNeedField[];
  /** The suggested stays for the needs as last priced; advice the guest can take or change. */
  combos: ConciergeCombo[];
  catalogue: ConciergeCatalogue | null;
  /** The stay being built: one room, one food and any add-ons per pet. */
  selection: ConciergeSelection | null;
  /** The server's price for `selection`; a combo's own quote while that combo is unchanged. */
  stayQuote: ConciergeQuote | null;
  pricing: PricingStatus;
  pricingError: LocalisedText | null;
  /** The combo the stay was taken from, while it is unchanged. */
  appliedComboId: string | null;
  /** The guest changed a line by hand; a new turn keeps their choices instead of a combo. */
  customised: boolean;
  /**
   * The services of a copied earlier stay ("same as last time"), waiting for the dates: applied
   * as the stay once combos exist for the same pets, then forgotten.
   */
  pendingSelection: ConciergeSelection | null;
  stayPanelOpen: boolean;
  stayPanelOpener: StayPanelOpener;
  /** Nights of the planned stay with no room left; the options are hidden while any is full. */
  fullNights: string[];
  /** The needs `combos` were priced for. */
  pricedNeeds: ConciergeNeeds | null;
  /** The assistant's fit and book-it hand-off, valid for the combos on screen. */
  plan: ConciergePlan | null;
  assistantMode: ConciergeAssistantMode | null;
  assistantAvailable: boolean;
  turnStatus: TurnStatus;
  /** What started the turn in flight: only a message or a tapped answer gets a reply. */
  turnTrigger: ConciergeTurnTrigger | null;
  turnError: LocalisedText | null;
  /** The trigger of a turn that failed, so "Try again" re-runs it without retyping. */
  lastFailedTrigger: ConciergeTurnTrigger | null;
  /** A checklist change is waiting to be priced; continuing with the stay waits for it. */
  refreshPending: boolean;
  /** Consecutive message turns that changed nothing. */
  missStreak: number;
  checklistOpen: boolean;
  /** A polite, one-off announcement: a price change, a renewed hold. */
  priceNotice: LocalisedText | null;
  /** The plan came back from an earlier visit in this tab. */
  restored: boolean;
  accepted: ConciergeAcceptQuoteResponse | null;
  /** The priced stay the acceptance was for; the summary and the receipt list its lines. */
  agreedQuote: ConciergeQuote | null;
  /** The needs the guest agreed to; details and confirmation show these, never later edits. */
  agreedNeeds: ConciergeNeeds | null;
  /** The signed-in parent's address, shown in the summary; the session itself is the proof. */
  verifiedEmail: string | null;
  /**
   * A guest's proof of an address, from the email-code flow the page no longer runs. Kept in the
   * shape (always null now) because checkout and the card setup still accept it.
   */
  verificationToken: string | null;
  verifiedAt: number | null;
  detailsDraft: DetailsDraft | null;
  /** Which pets (and saved-pet links) the draft's pet rows were built for. */
  draftBasis: string | null;
  checkoutResult: ConciergeCheckoutResponse | null;
  /** The stay the sent request was for, for the receipt. */
  booked: BookedStay | null;
  /** Saved pet ids picked for each position in needs.pets (signed-in owners). */
  savedPetLinks: Array<string | null>;
  savedPets: Record<string, SavedPetInfo>;
}

interface ConciergeActions {
  setLocale: (locale: ConciergeLocale) => void;
  /** From /status before the first turn, so the greeting is true from the start. */
  setAssistantMode: (mode: ConciergeAssistantMode) => void;
  sendMessage: (text: string) => Promise<void>;
  /** Shows the guest's words in the chat without a reply: a "confirm" the page acts on itself. */
  noteGuestMessage: (text: string) => void;
  chooseAnswer: (
    message: string,
    apply: (needs: ConciergeNeeds) => ConciergeNeeds,
  ) => Promise<void>;
  updateNeeds: (update: (needs: ConciergeNeeds) => ConciergeNeeds) => void;
  retryLastTurn: () => Promise<void>;
  /** Re-prices the current needs without a chat message; resolves with the new combos. */
  refreshQuotes: () => Promise<ConciergeCombo[] | null>;
  /** Takes a suggested stay as it is, with its signed price. */
  applyCombo: (comboId: string) => void;
  setPetRoom: (petIndex: number, roomId: string) => void;
  setPetFood: (petIndex: number, foodId: string) => void;
  togglePetAddon: (petIndex: number, addonId: string) => void;
  /** Prices the current selection again at once (a lapsed hold, a failed attempt). */
  repriceStay: () => Promise<ConciergeQuote | null>;
  openStayPanel: (opener?: StayPanelOpener) => void;
  closeStayPanel: () => void;
  setAccepted: (
    accepted: ConciergeAcceptQuoteResponse,
    options?: { keepStep?: boolean; skipVerify?: boolean; quote?: ConciergeQuote },
  ) => void;
  /** Signed in (token null): the plan moves on from the sign-in step. */
  setVerified: (email: string, verificationToken: string | null) => void;
  /** A signed-in parent's account name fills the name they sign with; they can still change it. */
  initDetailsDraft: () => void;
  updateDetailsDraft: (update: (draft: DetailsDraft) => DetailsDraft) => void;
  setCheckoutResult: (result: ConciergeCheckoutResponse) => void;
  goTo: (step: ConciergeStep) => void;
  backToOptions: () => void;
  setChecklistOpen: (open: boolean) => void;
  /** Signed-in owners: the plan's pets become exactly these saved pets (plus any described ones). */
  applySavedPets: (selection: SavedPetChoice[]) => void;
  /** The account's pets changed (they arrive after the page opens): link the plan's pets again. */
  relinkSavedPets: () => void;
  dismissRestored: () => void;
  clearPriceNotice: () => void;
  announce: (notice: LocalisedText) => void;
  startOver: () => void;
  /** Same as startOver; kept for tests and callers that only need a clean slate. */
  reset: () => void;
}

export type ConciergeState = ConciergeData & ConciergeActions;

let messageCounter = 0;
const nextMessageId = (): string => {
  messageCounter += 1;
  return `concierge-message-${Date.now().toString(36)}-${messageCounter}`;
};

const GREETING_ID = 'concierge-greeting';

const toGreetingMode = (mode: ConciergeAssistantMode | null): GreetingMode =>
  mode === 'claude' || mode === 'openai' ? 'model' : mode === 'rules' ? 'rules' : 'unknown';

/** The local first line, written for the assistant that actually answers (once that is known). */
const greetingFor = (
  locale: ConciergeLocale,
  mode: ConciergeAssistantMode | null,
): ConciergeUiMessage => ({
  id: GREETING_ID,
  role: 'assistant',
  text: CONCIERGE_COPY[locale].chat.greeting(toGreetingMode(mode)),
  localOnly: true,
});

const withGreeting = (
  messages: ConciergeUiMessage[],
  locale: ConciergeLocale,
  mode: ConciergeAssistantMode | null,
): ConciergeUiMessage[] =>
  messages.map((message) => (message.id === GREETING_ID ? greetingFor(locale, mode) : message));

/** What the server sees: real turns only, starting with the guest (the model requires that). */
const historyForServer = (messages: ConciergeUiMessage[]): ConciergeChatMessage[] => {
  const turns = messages
    .filter((message) => !message.localOnly)
    .map(({ role, text }) => ({ role, text: text.slice(0, MAX_MESSAGE_LENGTH) }))
    .slice(-MAX_HISTORY_MESSAGES);
  const firstUser = turns.findIndex((message) => message.role === 'user');
  return firstUser === -1 ? [] : turns.slice(firstUser);
};

const readRememberedLocale = (): ConciergeLocale | null => {
  try {
    const value = window.localStorage.getItem(LOCALE_KEY);
    return value === 'en' || value === 'zh' ? value : null;
  } catch {
    return null;
  }
};

const rememberLocale = (locale: ConciergeLocale): void => {
  try {
    window.localStorage.setItem(LOCALE_KEY, locale);
  } catch {
    // Remembering the language is a convenience only.
  }
};

/**
 * A link shared in a Chinese community group can say ?lang=zh; otherwise the guest's last choice.
 * Everyone else starts in English. The browser's languages are not used on purpose: English is
 * the site's default, and Chinese is shown only when the guest (or the link) asks for it.
 */
export const detectInitialLocale = (): ConciergeLocale => {
  if (typeof window === 'undefined') return 'en';
  const fromLink = new URLSearchParams(window.location.search).get('lang');
  if (fromLink === 'zh' || fromLink === 'en') return fromLink;
  return readRememberedLocale() ?? 'en';
};

const hasFreshVerification = (data: ConciergeData, now: number = Date.now()): boolean =>
  data.verificationToken !== null &&
  data.verifiedAt !== null &&
  now - data.verifiedAt < VERIFICATION_USABLE_MS;

export const selectHasFreshVerification = (state: ConciergeData): boolean =>
  hasFreshVerification(state);

/**
 * The plan's saved-pet links for these needs (see savedPetLinks.ts). A guest has no saved pets,
 * so for them this only keeps the plan as it is. A copied earlier stay brings its own links,
 * which replace the plan's: its pets are the plan's pets now.
 */
const linkedPlan = (
  needs: ConciergeNeeds,
  state: ConciergeData,
  copied: ConciergeLastStay | null = null,
): PlanPetLinks => {
  const brought = copied ? linksFromLastStay(copied) : null;
  return linkPlanPets(
    {
      needs,
      links: brought?.links ?? state.savedPetLinks,
      savedPets: brought ? { ...state.savedPets, ...brought.savedPets } : state.savedPets,
    },
    useAccountPetsStore.getState().pets.map(toSavedPetChoice),
    state.step === 'plan',
  );
};

const sameLinks = (a: Array<string | null>, b: Array<string | null>): boolean =>
  a.length === b.length && a.every((link, index) => link === b[index]);

const draftBasisFor = (needs: ConciergeNeeds, links: Array<string | null>): string =>
  JSON.stringify({ pets: needs.pets.map((pet) => [pet.species, pet.name ?? null]), links });

const blankContact = (): DetailsDraft['contact'] => ({
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  address: '',
  phone: '',
});

const draftFor = (needs: ConciergeNeeds, savedPetLinks: Array<string | null>): DetailsDraft => ({
  contact: blankContact(),
  pets: needs.pets.map((pet, index) => ({
    existingPetId: savedPetLinks[index] ?? null,
    name: pet.name ?? '',
    breed: '',
  })),
  dropOffTime: DEFAULT_DROP_OFF,
  pickUpTime: DEFAULT_PICK_UP,
  // What the guest told the assistant reaches staff only if it is in the request, so it is
  // carried over visibly for them to check.
  careNotes: needs.notes,
  // Never pre-ticked: agreeing to the terms and to the card rules is the guest's own act.
  termsAccepted: false,
  vetConsent: false,
});

/** What the guest told the assistant, carried into a fresh form for them to check and change. */
const withPrefill = (draft: DetailsDraft, prefill: ConciergePlanPrefill | null): DetailsDraft =>
  prefill
    ? {
        ...draft,
        contact: {
          ...draft.contact,
          firstName: prefill.firstName ?? draft.contact.firstName,
          lastName: prefill.lastName ?? draft.contact.lastName,
          phone: prefill.phone ?? draft.contact.phone,
        },
        dropOffTime: prefill.dropOffTime ?? draft.dropOffTime,
        pickUpTime: prefill.pickUpTime ?? draft.pickUpTime,
        careNotes: prefill.careNotes ?? draft.careNotes,
      }
    : draft;

const emptyStay: StayChoice = {
  selection: null,
  stayQuote: null,
  appliedComboId: null,
  customised: false,
};

const initialState = (locale: ConciergeLocale): ConciergeData => ({
  locale,
  step: 'plan',
  messages: [greetingFor(locale, null)],
  needs: createEmptyNeeds(),
  missingFields: ['dates', 'pets'],
  combos: [],
  catalogue: null,
  ...emptyStay,
  pendingSelection: null,
  pricing: 'idle',
  pricingError: null,
  stayPanelOpen: false,
  stayPanelOpener: 'button',
  fullNights: [],
  pricedNeeds: null,
  plan: null,
  assistantMode: null,
  assistantAvailable: true,
  turnStatus: 'idle',
  turnTrigger: null,
  turnError: null,
  lastFailedTrigger: null,
  refreshPending: false,
  missStreak: 0,
  checklistOpen: false,
  priceNotice: null,
  restored: false,
  accepted: null,
  agreedQuote: null,
  agreedNeeds: null,
  verifiedEmail: null,
  verificationToken: null,
  verifiedAt: null,
  detailsDraft: null,
  draftBasis: null,
  checkoutResult: null,
  booked: null,
  savedPetLinks: [],
  savedPets: {},
});

const fromSnapshot = (snapshot: ConciergeSnapshot): ConciergeData => ({
  ...initialState(snapshot.locale),
  step: snapshot.step,
  messages: [
    greetingFor(snapshot.locale, snapshot.assistantMode),
    ...snapshot.messages.filter((m) => m.id !== GREETING_ID),
  ],
  needs: snapshot.needs,
  missingFields: snapshot.missingFields,
  combos: snapshot.combos,
  catalogue: snapshot.catalogue,
  selection: snapshot.selection,
  stayQuote: snapshot.stayQuote,
  appliedComboId: snapshot.appliedComboId,
  customised: snapshot.customised,
  pricedNeeds: snapshot.pricedNeeds,
  assistantMode: snapshot.assistantMode,
  accepted: snapshot.accepted,
  agreedQuote: snapshot.agreedQuote,
  agreedNeeds: snapshot.agreedNeeds,
  verifiedEmail: snapshot.verifiedEmail,
  verificationToken: snapshot.verificationToken,
  verifiedAt: snapshot.verifiedAt,
  detailsDraft: snapshot.detailsDraft
    ? {
        ...snapshot.detailsDraft,
        contact: blankContact(),
        termsAccepted: false,
        vetConsent: false,
      }
    : null,
  draftBasis: snapshot.detailsDraft ? draftBasisFor(snapshot.needs, snapshot.savedPetLinks) : null,
  checkoutResult: snapshot.checkoutResult,
  booked: snapshot.booked,
  savedPetLinks: snapshot.savedPetLinks,
  savedPets: snapshot.savedPets,
  restored:
    snapshot.messages.some((message) => message.role === 'user') ||
    snapshot.step !== 'plan' ||
    snapshot.needs.pets.length > 0,
});

/**
 * The receipt kept in the tab says which stays are confirmed and which wait, but not the pets'
 * names: nothing that names a person or a pet stays in the tab after sending. The screen shows
 * "Pet 1" and so on after a reload.
 */
const withoutPetNames = (result: ConciergeCheckoutResponse): ConciergeCheckoutResponse => ({
  ...result,
  pets: (result.pets ?? []).map((pet) => ({ ...pet, name: '' })),
});

/**
 * After the request is sent only what the request receipt shows is kept: the dates here, and the
 * booked stay's lines in `booked`. No chat, notes or names.
 */
const confirmationOnly = (needs: ConciergeNeeds | null): ConciergeNeeds => ({
  ...createEmptyNeeds(),
  startDate: needs?.startDate ?? null,
  endDate: needs?.endDate ?? null,
});

const toSnapshot = (state: ConciergeData): ConciergeSnapshot => {
  const done = state.step === 'done';
  return {
    version: SNAPSHOT_VERSION,
    savedAt: Date.now(),
    locale: state.locale,
    step: state.step,
    messages: done ? [] : state.messages.filter((message) => message.id !== GREETING_ID),
    needs: done ? confirmationOnly(state.agreedNeeds ?? state.needs) : state.needs,
    missingFields: state.missingFields,
    combos: done ? [] : state.combos,
    catalogue: done ? null : state.catalogue,
    selection: done ? null : state.selection,
    stayQuote: done ? null : state.stayQuote,
    appliedComboId: done ? null : state.appliedComboId,
    customised: done ? false : state.customised,
    pricedNeeds: done ? null : state.pricedNeeds,
    assistantMode: state.assistantMode,
    accepted: state.accepted,
    agreedQuote: done ? null : state.agreedQuote,
    agreedNeeds: done ? confirmationOnly(state.agreedNeeds ?? state.needs) : state.agreedNeeds,
    verifiedEmail: done ? null : state.verifiedEmail,
    verificationToken: state.verificationToken,
    verifiedAt: state.verifiedAt,
    detailsDraft: state.detailsDraft
      ? {
          pets: done ? [] : state.detailsDraft.pets,
          dropOffTime: state.detailsDraft.dropOffTime,
          pickUpTime: state.detailsDraft.pickUpTime,
          careNotes: done ? '' : state.detailsDraft.careNotes,
        }
      : null,
    checkoutResult: state.checkoutResult ? withoutPetNames(state.checkoutResult) : null,
    booked: state.booked,
    savedPetLinks: done ? [] : state.savedPetLinks,
    savedPets: done ? {} : state.savedPets,
  };
};

const stayOf = (state: ConciergeData): StayChoice => ({
  selection: state.selection,
  stayQuote: state.stayQuote,
  appliedComboId: state.appliedComboId,
  customised: state.customised,
});

let latestTurn = 0;
let latestPricing = 0;
let checklistTimer: ReturnType<typeof setTimeout> | null = null;
let priceTimer: ReturnType<typeof setTimeout> | null = null;

const clearChecklistTimer = (): void => {
  if (checklistTimer) clearTimeout(checklistTimer);
  checklistTimer = null;
};

const clearPriceTimer = (): void => {
  if (priceTimer) clearTimeout(priceTimer);
  priceTimer = null;
};

const startingState = (): ConciergeData => {
  const snapshot = loadSnapshot();
  return snapshot ? fromSnapshot(snapshot) : initialState(detectInitialLocale());
};

export const useConciergeStore = create<ConciergeState>((set, get) => {
  const scheduleRefresh = (): void => {
    clearChecklistTimer();
    checklistTimer = setTimeout(() => {
      checklistTimer = null;
      void runTurn('checklist');
    }, CHECKLIST_REFRESH_DELAY_MS);
  };

  /** Prices the current selection; only the newest request may change the stay. */
  const runPrice = async (): Promise<ConciergeQuote | null> => {
    clearPriceTimer();
    latestPricing += 1;
    const request = latestPricing;
    const state = get();
    if (!state.selection) return null;
    set({ pricing: 'pricing', pricingError: null });
    try {
      const { quote } = await conciergeApi.priceSelection({
        // The needs the combos were built for: a checklist change still waiting to be priced is
        // priced by the next turn, which carries the selection over.
        needs: state.agreedNeeds ?? state.pricedNeeds ?? state.needs,
        selection: state.selection,
        locale: state.locale,
      });
      if (request !== latestPricing) return null;
      // The server adds compulsory add-ons and medication handling; show the stay as priced.
      set({ stayQuote: quote, selection: quote.selection, pricing: 'idle' });
      return quote;
    } catch (error: unknown) {
      if (request !== latestPricing) return null;
      const refused =
        describeConciergeError(error, CONCIERGE_COPY.en).code === 'CONCIERGE_SELECTION_INVALID';
      set((current) => {
        // A combination the facility cannot run goes back to the last priced stay; any other
        // failure keeps the ticks and offers to try again.
        const reverted =
          refused && current.stayQuote
            ? stayAfterEdit(current.stayQuote.selection, current.combos)
            : null;
        return {
          ...(reverted ? { ...reverted, stayQuote: current.stayQuote } : {}),
          pricing: reverted ? 'idle' : 'error',
          pricingError: (words): string => describeConciergeError(error, words).message,
        };
      });
      return null;
    }
  };

  const schedulePrice = (): void => {
    clearPriceTimer();
    // An answer still on its way is for a stay that has already changed.
    latestPricing += 1;
    set({ pricing: 'pricing', pricingError: null });
    priceTimer = setTimeout(() => {
      priceTimer = null;
      void runPrice();
    }, PRICE_REFRESH_DELAY_MS);
  };

  const editStay = (change: (selection: ConciergeSelection) => ConciergeSelection): void => {
    const state = get();
    if (!state.selection) return;
    const next = stayAfterEdit(change(state.selection), state.combos);
    // The last price stays on screen, marked as updating, until the server answers for the edit;
    // continuing waits for that answer, so the old price can never be accepted for the new stay.
    set({
      ...next,
      stayQuote: next.stayQuote ?? state.stayQuote,
      priceNotice: null,
      pricingError: null,
    });
    if (next.stayQuote) {
      clearPriceTimer();
      latestPricing += 1;
      set({ pricing: 'idle' });
    } else {
      schedulePrice();
    }
  };

  /** A new price for the same suggested stay is announced, never swapped in quietly. */
  const priceChangeNotice = (
    state: ConciergeData,
    next: StayChoice,
    needs: ConciergeNeeds,
  ): LocalisedText | null => {
    const before = state.stayQuote;
    const after = next.stayQuote;
    const sameCombo = next.appliedComboId !== null && next.appliedComboId === state.appliedComboId;
    if (!before || !after || !sameCombo || before.total === after.total) return state.priceNotice;
    const petNames = needs.pets.map((pet) => pet.name);
    const name = stayNameText(after.lines, petNames, CONCIERGE_COPY[state.locale], state.locale);
    return (words): string =>
      words.packages.priceChanged(name, formatNzd(before.total), formatNzd(after.total));
  };

  /** The panel opens itself when a reply brings the first options, or any reply after a message. */
  const opensPanel = (
    state: ConciergeData,
    trigger: ConciergeTurnTrigger,
    response: ConciergeChatResponse,
  ): boolean =>
    response.combos.length > 0 &&
    (trigger === 'message' || (trigger === 'choice' && state.combos.length === 0));

  const runTurn = async (trigger: ConciergeTurnTrigger): Promise<ConciergeChatResponse | null> => {
    latestTurn += 1;
    const turn = latestTurn;
    const { messages, needs, locale, step: startedOn } = get();
    set({ turnStatus: 'sending', turnTrigger: trigger, turnError: null, refreshPending: false });
    try {
      const response = await conciergeApi.chat({
        messages: historyForServer(messages),
        needs,
        locale,
        trigger,
      });
      if (turn !== latestTurn) return null;
      if (startedOn === 'plan' && get().step !== 'plan') {
        // The guest agreed while this was on its way; the agreed plan is what counts now.
        set({ turnStatus: 'idle', turnTrigger: null });
        return null;
      }

      const reply: ConciergeUiMessage[] = response.reply
        ? [
            {
              id: nextMessageId(),
              role: 'assistant',
              text: response.reply,
              ...(response.assistantAvailable ? {} : { tone: 'notice' as const, localOnly: true }),
              ...(response.combos.length > 0 ? { offersStay: true as const } : {}),
            },
          ]
        : [];
      // A tick made while a checklist refresh was on its way is kept, and priced next.
      const editedMeanwhile = !sameNeeds(get().needs, needs);
      const answeredNeeds = editedMeanwhile ? get().needs : response.needs;
      // A pet named in the chat may be a saved pet; what the account knows about it is priced next.
      const linked = linkedPlan(answeredNeeds, get(), response.lastStay);
      const factsFilled = linked.needs !== answeredNeeds;
      let needsPrice = false;
      set((state) => {
        // A copied earlier stay waits until combos exist for its pets, then becomes the stay.
        const pending = response.lastStay?.selection ?? state.pendingSelection;
        const copiedStay =
          pending && response.combos.length > 0
            ? stayFromCopiedSelection(
                pending,
                response.combos,
                response.catalogue,
                response.needs,
                response.plan,
              )
            : null;
        const stay =
          copiedStay ??
          stayAfterTurn(
            stayOf(state),
            response.combos,
            response.catalogue,
            response.needs,
            response.plan,
          );
        needsPrice =
          stay.selection !== null && stay.stayQuote === null && response.combos.length > 0;
        const changedNothing = trigger === 'message' && sameNeeds(needs, response.needs);
        const panelOpens = opensPanel(state, trigger, response) || copiedStay !== null;
        return {
          messages: [
            ...withGreeting(state.messages, state.locale, response.assistantMode),
            ...reply,
          ],
          needs: linked.needs,
          missingFields: response.missingFields,
          combos: response.combos,
          catalogue: response.catalogue,
          ...stay,
          // Once combos exist the copy is either applied or no longer fits the pets.
          pendingSelection: response.combos.length > 0 ? null : pending,
          pricing: needsPrice ? 'pricing' : 'idle',
          pricingError: null,
          stayPanelOpen: state.stayPanelOpen || panelOpens,
          stayPanelOpener: panelOpens ? 'combos' : state.stayPanelOpener,
          fullNights: response.fullNights,
          plan: response.plan,
          pricedNeeds: response.needs,
          assistantMode: response.assistantMode,
          assistantAvailable: response.assistantAvailable,
          priceNotice: priceChangeNotice(state, stay, response.needs),
          turnStatus: 'idle',
          turnTrigger: null,
          lastFailedTrigger: null,
          refreshPending: editedMeanwhile || factsFilled || state.refreshPending,
          missStreak:
            trigger === 'message' ? (changedNothing ? state.missStreak + 1 : 0) : state.missStreak,
          checklistOpen: state.checklistOpen || !response.assistantAvailable,
          savedPetLinks: linked.links,
          savedPets: linked.savedPets,
        };
      });
      if (needsPrice) void runPrice();
      if ((editedMeanwhile || factsFilled) && checklistTimer === null) scheduleRefresh();
      return response;
    } catch (error: unknown) {
      if (turn !== latestTurn) return null;
      set({
        turnStatus: 'error',
        turnTrigger: null,
        turnError: (words) => describeConciergeError(error, words).message,
        lastFailedTrigger: trigger,
      });
      return null;
    }
  };

  const startOver = (): void => {
    clearChecklistTimer();
    clearPriceTimer();
    latestTurn += 1;
    latestPricing += 1;
    clearSnapshot();
    set(initialState(get().locale));
  };

  return {
    ...startingState(),

    setLocale: (locale): void => {
      rememberLocale(locale);
      set((state) => ({
        locale,
        messages: withGreeting(state.messages, locale, state.assistantMode),
      }));
    },

    setAssistantMode: (assistantMode): void => {
      set((state) =>
        state.assistantMode === assistantMode
          ? state
          : { assistantMode, messages: withGreeting(state.messages, state.locale, assistantMode) },
      );
    },

    sendMessage: async (text): Promise<void> => {
      const trimmed = text.trim().slice(0, MAX_MESSAGE_LENGTH);
      if (!trimmed) return;
      clearChecklistTimer();
      set((state) => ({
        messages: [...state.messages, { id: nextMessageId(), role: 'user', text: trimmed }],
        restored: false,
      }));
      await runTurn('message');
    },

    noteGuestMessage: (text): void => {
      const trimmed = text.trim().slice(0, MAX_MESSAGE_LENGTH);
      if (!trimmed) return;
      set((state) => ({
        messages: [...state.messages, { id: nextMessageId(), role: 'user', text: trimmed }],
        restored: false,
      }));
    },

    chooseAnswer: async (message, apply): Promise<void> => {
      clearChecklistTimer();
      set((state) => {
        const linked = linkedPlan(apply(state.needs), state);
        return {
          messages: [...state.messages, { id: nextMessageId(), role: 'user', text: message }],
          needs: linked.needs,
          savedPetLinks: linked.links,
          savedPets: linked.savedPets,
          restored: false,
        };
      });
      await runTurn('choice');
    },

    updateNeeds: (update): void => {
      set((state) => {
        const linked = linkedPlan(update(state.needs), state);
        return {
          needs: linked.needs,
          savedPetLinks: linked.links,
          savedPets: linked.savedPets,
          refreshPending: true,
        };
      });
      scheduleRefresh();
    },

    retryLastTurn: async (): Promise<void> => {
      const trigger = get().lastFailedTrigger;
      if (trigger) await runTurn(trigger);
    },

    refreshQuotes: async (): Promise<ConciergeCombo[] | null> => {
      clearChecklistTimer();
      const response = await runTurn('checklist');
      return response ? response.combos : null;
    },

    applyCombo: (comboId): void => {
      const combo = get().combos.find((candidate) => candidate.id === comboId);
      if (!combo) return;
      clearPriceTimer();
      latestPricing += 1;
      set({ ...stayFromCombo(combo), pricing: 'idle', pricingError: null, priceNotice: null });
    },

    setPetRoom: (petIndex, roomId): void =>
      editStay((selection) => withPetRoom(selection, petIndex, roomId)),

    setPetFood: (petIndex, foodId): void =>
      editStay((selection) => withPetFood(selection, petIndex, foodId)),

    togglePetAddon: (petIndex, addonId): void =>
      editStay((selection) => withPetAddonToggled(selection, petIndex, addonId)),

    repriceStay: runPrice,

    // Never over the verify, details or done screens: there the stay is already agreed.
    openStayPanel: (opener = 'button'): void =>
      set((state) =>
        state.step === 'plan' ? { stayPanelOpen: true, stayPanelOpener: opener } : {},
      ),

    closeStayPanel: (): void => set({ stayPanelOpen: false }),

    setAccepted: (accepted, options): void => {
      // Nothing edited before the click may re-price the plan behind the agreement.
      clearChecklistTimer();
      set((state) => ({
        accepted,
        agreedQuote: options?.quote ?? state.stayQuote,
        agreedNeeds: state.pricedNeeds ?? state.needs,
        refreshPending: false,
        stayPanelOpen: false,
        // The terms box agrees to send this request. A newly chosen stay is a new request, so
        // it is ticked again; renewing the same price in place (keepStep) keeps the tick.
        detailsDraft:
          state.detailsDraft && !options?.keepStep
            ? { ...state.detailsDraft, termsAccepted: false }
            : state.detailsDraft,
        // A signed-in parent (skipVerify) goes straight to the details; a guest signs in first.
        step: options?.keepStep ? state.step : options?.skipVerify ? 'details' : 'verify',
      }));
    },

    setVerified: (email, verificationToken): void =>
      set((state) => ({
        verifiedEmail: email,
        verificationToken,
        verifiedAt: verificationToken ? Date.now() : null,
        step: state.step === 'verify' ? 'details' : state.step,
      })),

    initDetailsDraft: (): void =>
      set((state) => {
        const needs = state.agreedNeeds ?? state.needs;
        const basis = draftBasisFor(needs, state.savedPetLinks);
        const draft = state.detailsDraft;
        if (draft && state.draftBasis === basis) return {};
        const fresh = withPrefill(
          draftFor(needs, state.savedPetLinks),
          state.plan?.prefill ?? null,
        );
        // The pets changed (or this is the first visit): rebuild the pet rows, keep what was typed.
        return {
          draftBasis: basis,
          detailsDraft: draft
            ? {
                ...fresh,
                contact: draft.contact,
                termsAccepted: draft.termsAccepted,
                vetConsent: draft.vetConsent,
                careNotes: draft.careNotes,
                dropOffTime: draft.dropOffTime,
                pickUpTime: draft.pickUpTime,
              }
            : fresh,
        };
      }),

    updateDetailsDraft: (update): void =>
      set((state) => ({
        detailsDraft: update(
          state.detailsDraft ?? draftFor(state.agreedNeeds ?? state.needs, state.savedPetLinks),
        ),
      })),

    setCheckoutResult: (result): void => {
      clearChecklistTimer();
      clearPriceTimer();
      set((state) => ({
        checkoutResult: result,
        // Worked out now, while the agreed stay is known: it is cleared below. The receipt then
        // shows what the price covers.
        booked: state.agreedQuote ? { lines: state.agreedQuote.lines } : null,
        step: 'done',
        // The proofs are spent, and only what the confirmation shows stays: no chat, notes, pet
        // names or contact details (the privacy notice says so).
        accepted: null,
        agreedQuote: null,
        verificationToken: null,
        verifiedAt: null,
        combos: [],
        catalogue: null,
        ...emptyStay,
        pendingSelection: null,
        pricing: 'idle',
        pricingError: null,
        stayPanelOpen: false,
        pricedNeeds: null,
        plan: null,
        messages: [greetingFor(state.locale, state.assistantMode)],
        needs: confirmationOnly(state.agreedNeeds ?? state.needs),
        agreedNeeds: confirmationOnly(state.agreedNeeds ?? state.needs),
        savedPetLinks: [],
        savedPets: {},
        detailsDraft: state.detailsDraft
          ? {
              ...state.detailsDraft,
              contact: blankContact(),
              termsAccepted: false,
              vetConsent: false,
              careNotes: '',
              pets: [],
            }
          : null,
      }));
    },

    goTo: (step): void => set({ step }),

    backToOptions: (): void =>
      set((state) => ({
        step: 'plan',
        accepted: null,
        agreedQuote: null,
        agreedNeeds: null,
        // The recommendation stands; the hand-off does not run again on its own.
        plan: state.plan ? { ...state.plan, bookRequested: false } : null,
      })),

    setChecklistOpen: (open): void => set({ checklistOpen: open }),

    applySavedPets: (selection): void => {
      set((state) => {
        const savedPets = { ...state.savedPets };
        const chosen = selection.slice(0, CONCIERGE_MAX_PETS).map((saved) => {
          savedPets[saved.id] = { name: saved.name, species: saved.species };
          const position = state.savedPetLinks.indexOf(saved.id);
          const known = position === -1 ? undefined : state.needs.pets[position];
          return { link: saved.id, pet: known ?? petNeedFor(saved) };
        });
        const described = state.needs.pets
          .map((pet, index) => ({ link: state.savedPetLinks[index] ?? null, pet }))
          .filter((entry) => entry.link === null);
        const combined = [...chosen, ...described].slice(0, CONCIERGE_MAX_PETS);
        return {
          needs: { ...state.needs, service: 'boarding', pets: combined.map((entry) => entry.pet) },
          savedPetLinks: combined.map((entry) => entry.link),
          savedPets,
          refreshPending: true,
          restored: false,
        };
      });
      scheduleRefresh();
    },

    relinkSavedPets: (): void => {
      const state = get();
      const linked = linkedPlan(state.needs, state);
      const factsFilled = linked.needs !== state.needs;
      if (!factsFilled && sameLinks(linked.links, state.savedPetLinks)) return;
      set({
        needs: linked.needs,
        savedPetLinks: linked.links,
        savedPets: linked.savedPets,
        ...(factsFilled ? { refreshPending: true } : {}),
      });
      if (factsFilled) scheduleRefresh();
    },

    dismissRestored: (): void => set({ restored: false }),

    clearPriceNotice: (): void => set({ priceNotice: null }),

    announce: (notice): void => set({ priceNotice: notice }),

    startOver,

    reset: startOver,
  };
});

/** Nothing worth resuming: no guest turn, no details, still on the first screen. */
const isBlank = (state: ConciergeData): boolean =>
  state.step === 'plan' &&
  !state.messages.some((message) => message.role === 'user') &&
  sameNeeds(state.needs, createEmptyNeeds()) &&
  state.verificationToken === null;

// Every change is kept for this tab, so a reload (or a discarded phone tab) resumes the plan.
useConciergeStore.subscribe((state) => {
  if (isBlank(state)) clearSnapshot();
  else saveSnapshot(toSnapshot(state));
});

// Signing out ends the plan on this device, so the next person at a shared computer starts clean.
useAuthStore.subscribe((state, previous) => {
  if (previous.user && !state.user) useConciergeStore.getState().startOver();
});

// The saved pets arrive after the page opens: a pet already named in the chat is linked then.
useAccountPetsStore.subscribe((state, previous) => {
  if (state.pets !== previous.pets) useConciergeStore.getState().relinkSavedPets();
});

/** The combos on screen were priced for different needs than the ones now shown. */
export const selectCombosStale = (state: ConciergeData): boolean =>
  state.combos.length > 0 &&
  state.pricedNeeds !== null &&
  !sameNeeds(state.needs, state.pricedNeeds);

/** True while a new price is on its way or owed; continuing waits so nobody accepts an old one. */
export const selectRepricing = (state: ConciergeData): boolean =>
  state.refreshPending ||
  state.turnStatus === 'sending' ||
  state.pricing !== 'idle' ||
  selectCombosStale(state);

/** The assistant is composing a reply (not just a quiet re-price after a tick). */
export const selectAssistantThinking = (state: ConciergeData): boolean =>
  state.turnStatus === 'sending' &&
  (state.turnTrigger === 'message' || state.turnTrigger === 'choice');

/** The needs the details step and confirmation describe: the agreed ones, once agreed. */
export const selectBookedNeeds = (state: ConciergeData): ConciergeNeeds =>
  state.agreedNeeds ?? state.needs;

/** Suggested stays exist, so the stay panel has something to show. */
export const selectHasStay = (state: ConciergeData): boolean => state.combos.length > 0;
