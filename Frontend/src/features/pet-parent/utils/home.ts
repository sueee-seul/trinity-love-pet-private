// Copy and routing rules for the pet-parent homepage. Kept out of the
// components so the state-driven wording (docs/homepage-ui-design-prompt.md §5)
// is easy to check in one place and unit-test. The words themselves live in
// homeCopy.ts; every helper that writes text takes the portal locale, and its
// 'en' default keeps callers that do not pass one reading English.
import type { PortalLocale } from '../i18n/portalLocale';
import type {
  ChecklistItem,
  CurrentStay,
  HomePet,
  HomeState,
  StayGroupSummary,
  UpcomingStay,
} from '../types/home';
import { HOME_TEXT, type NameConjunction, type QuickActionKey } from './homeCopy';
import { breedText } from './breedNames';

export type QuickActionIcon = 'plus' | 'user' | 'calendar' | 'paw' | 'list' | 'check' | 'star';

export interface QuickAction {
  key: QuickActionKey;
  label: string;
  icon: QuickActionIcon;
  /** Router path. */
  to: string;
}

// Adding and managing pets open the pets tab; Profile (and anything else that
// just says profile) goes to the main profile page.
const PROFILE = '/parent/profile';
export const PETS_TAB_LINK = '/parent/profile?tab=pets';
const BOOKING = '/parent/booking';
const STAYS = '/parent/stays';
const FEEDBACK = '/parent/feedback';

/** The booking page's query parameter that opens the plan with one saved pet already chosen. */
export const BOOKING_PET_PARAM = 'pet';

/** "Book a stay" for one pet: its card on Home and its own page link here. */
export function bookingLinkForPet(petId: string): string {
  return `${BOOKING}?${new URLSearchParams({ [BOOKING_PET_PARAM]: petId }).toString()}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Max", "Max and Luna", "Max, Luna and Rex"; with the Chinese list comma and "and" in Chinese. */
export function joinNames(
  names: string[],
  conjunction: NameConjunction = 'and',
  locale: PortalLocale = 'en',
): string {
  if (names.length <= 1) return names[0] ?? '';
  const text = HOME_TEXT[locale];
  const leading = names.slice(0, -1).join(text.nameSeparator);
  return `${leading} ${text.conjunctions[conjunction]} ${names[names.length - 1]}`;
}

/** "Max's", "Max and Luna's". */
export function possessive(names: string[], locale: PortalLocale = 'en'): string {
  return HOME_TEXT[locale].possessive(joinNames(names, 'and', locale));
}

/**
 * The breed when the server has one, otherwise the species, and the age when known, apart. A
 * narrow card shows them on two lines, so a long breed never leaves the separator on its own.
 */
export function petMetaParts(
  pet: HomePet,
  locale: PortalLocale = 'en',
): { kind: string; age: string | null } {
  const text = HOME_TEXT[locale];
  return {
    kind: breedText(pet.breed, locale, text.species[pet.species]),
    age: pet.ageYears === undefined ? null : text.age(pet.ageYears),
  };
}

/** The breed (or species), then the age, on one line. */
export function petMeta(pet: HomePet, locale: PortalLocale = 'en'): string {
  const { kind, age } = petMetaParts(pet, locale);
  return age === null ? kind : `${kind} · ${age}`;
}

export function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}

/** "12 Sep" */
export function formatDay(iso: string, locale: PortalLocale = 'en'): string {
  const date = new Date(iso);
  return locale === 'zh'
    ? `${date.getMonth() + 1}月${date.getDate()}日`
    : `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/** "Aug 2026" */
export function formatMonthYear(iso: string, locale: PortalLocale = 'en'): string {
  const date = new Date(iso);
  return locale === 'zh'
    ? `${date.getFullYear()}年${date.getMonth() + 1}月`
    : `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** "12 Sep to 16 Sep" */
export function formatStayRange(
  dropOffAt: string,
  pickUpAt: string,
  locale: PortalLocale = 'en',
): string {
  const separator = locale === 'zh' ? '至' : ' to ';
  return `${formatDay(dropOffAt, locale)}${separator}${formatDay(pickUpAt, locale)}`;
}

/** "12 to 16 Sep" when both dates share a month, otherwise "28 Sep to 2 Oct". */
export function formatCompactRange(
  dropOffAt: string,
  pickUpAt: string,
  locale: PortalLocale = 'en',
): string {
  const start = new Date(dropOffAt);
  const end = new Date(pickUpAt);
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return locale === 'zh'
      ? `${end.getMonth() + 1}月${start.getDate()}日至${end.getDate()}日`
      : `${start.getDate()} to ${end.getDate()} ${MONTHS[end.getMonth()]}`;
  }
  return formatStayRange(dropOffAt, pickUpAt, locale);
}

export function nightsLabel(nights: number, locale: PortalLocale = 'en'): string {
  return HOME_TEXT[locale].nights(nights);
}

export function daysToGoLabel(days: number, locale: PortalLocale = 'en'): string {
  const text = HOME_TEXT[locale];
  return days <= 0 ? text.today : text.daysToGo(days);
}

/** The compact-row form used in "Also coming up": "16 days" rather than "16 days to go". */
export function daysToGoCompactLabel(days: number, locale: PortalLocale = 'en'): string {
  const text = HOME_TEXT[locale];
  return days <= 0 ? text.today : text.daysToGoCompact(days);
}

export interface Greeting {
  title: string;
  subline: string | null;
}

export function greetingFor(
  state: HomeState,
  firstName: string | null,
  pets: HomePet[],
  hasCurrentStay = false,
  locale: PortalLocale = 'en',
): Greeting {
  const text = HOME_TEXT[locale];
  const welcomeBack = text.welcomeBack(firstName);
  const petNames = pets.map((pet) => pet.name);
  // A stay under way leads the page, so, like C1/C2, the hero carries the message.
  if (hasCurrentStay) return { title: welcomeBack, subline: null };
  switch (state) {
    case 'A':
      return { title: text.welcome(firstName), subline: text.firstStaySubline };
    case 'B1':
      return { title: welcomeBack, subline: text.planFirstStaySubline };
    case 'B2':
      return { title: welcomeBack, subline: text.nextStaySubline(possessive(petNames, locale)) };
    default:
      // C1 / C2: the hero carries the message, so there is no sub-line.
      return { title: welcomeBack, subline: null };
  }
}

export interface BookHeroCopy {
  title: string;
  body: string;
  showPastBookings: boolean;
}

export function bookHeroFor(
  state: 'B1' | 'B2',
  pets: HomePet[],
  locale: PortalLocale = 'en',
): BookHeroCopy {
  const text = HOME_TEXT[locale];
  if (state === 'B1') {
    const names = joinNames(
      pets.map((p) => p.name),
      'or',
      locale,
    );
    return { title: text.bookFirstTitle, body: text.bookFirstBody(names), showPastBookings: false };
  }
  return { title: text.bookAnotherTitle, body: text.bookAnotherBody, showPastBookings: true };
}

export function upcomingTitle(stay: UpcomingStay, locale: PortalLocale = 'en'): string {
  const names = stay.pets.map((pet) => pet.name);
  return HOME_TEXT[locale].stayComingUp(possessive(names, locale));
}

/** "Max is staying with us", "Max and Luna are staying with us". */
export function stayingTitle(stay: StayGroupSummary, locale: PortalLocale = 'en'): string {
  const names = stay.pets.map((pet) => pet.name);
  return HOME_TEXT[locale].stayingWithUs(joinNames(names, 'and', locale), names.length);
}

/** "Pick-up today", "Pick-up tomorrow", "Pick-up in 3 days". */
export function pickUpLabel(daysUntilPickUp: number, locale: PortalLocale = 'en'): string {
  const text = HOME_TEXT[locale];
  if (daysUntilPickUp <= 0) return text.pickUpToday;
  if (daysUntilPickUp === 1) return text.pickUpTomorrow;
  return text.pickUpInDays(daysUntilPickUp);
}

/** Live Care for the first pet on the booking; the page switches between the others. */
export function liveCareLink(stay: CurrentStay): string {
  const first = stay.pets[0];
  return first ? `/parent/live-care/${first.bookingPetId}` : '/parent/live-care';
}

/** Where an outstanding checklist row leads; null when it has nowhere to go yet. */
export function checklistLink(item: ChecklistItem): string | null {
  if (item.status === 'done' || !item.tappable) return null;
  switch (item.key) {
    case 'vaccination': {
      const bookingPetId = item.bookingPetIds?.[0];
      return bookingPetId ? `/parent/vaccination/${bookingPetId}` : null;
    }
    case 'agreement':
    case 'payment':
      return STAYS;
    default:
      return null;
  }
}

/** "Prepare for stay" goes to the first outstanding item that has somewhere to go. */
export function prepareLink(checklist: ChecklistItem[]): string | null {
  for (const item of checklist) {
    const link = checklistLink(item);
    if (link) return link;
  }
  return null;
}

/**
 * The specific preparation issue to show in the "Also coming up" status chip:
 * the same first outstanding, actionable item `prepareLink` would send the
 * parent to, or null when nothing needs their attention. Excludes items that
 * are outstanding but not tappable (admission verification has no page yet),
 * since those can never be resolved from here and would otherwise make
 * "All set" unreachable.
 */
export function outstandingIssueLabel(
  checklist: ChecklistItem[],
  locale: PortalLocale = 'en',
): string | null {
  const item = checklist.find((entry) => entry.status === 'outstanding' && entry.tappable);
  // The chip names the specific thing still needed, unlike the row's own label, which the server
  // writes as a statement of fact ("Vaccination information"). A key without chip wording falls
  // back to that server label.
  return item ? (HOME_TEXT[locale].issueLabels[item.key] ?? item.label) : null;
}

type QuickActionPlace = Pick<QuickAction, 'icon' | 'to'>;
type FixedQuickActionKey = Exclude<QuickActionKey, 'prepare' | 'live-care'>;

// Where each cell leads. "Prepare" and "Today's updates" take their link from the stay they serve.
const FIXED_QUICK_ACTIONS: Record<FixedQuickActionKey, QuickActionPlace> = {
  stays: { icon: 'list', to: STAYS },
  pets: { icon: 'paw', to: PETS_TAB_LINK },
  book: { icon: 'calendar', to: BOOKING },
  feedback: { icon: 'star', to: FEEDBACK },
  profile: { icon: 'user', to: PROFILE },
  'add-your-pet': { icon: 'plus', to: PETS_TAB_LINK },
};

/** The grid's last three cells while a stay is booked or under way. */
const STAY_FOLLOW_UPS: readonly FixedQuickActionKey[] = ['stays', 'book', 'feedback'];

function quickAction(
  key: QuickActionKey,
  place: QuickActionPlace,
  locale: PortalLocale,
): QuickAction {
  return { key, label: HOME_TEXT[locale].quickActions[key], ...place };
}

function fixedActions(keys: readonly FixedQuickActionKey[], locale: PortalLocale): QuickAction[] {
  return keys.map((key) => quickAction(key, FIXED_QUICK_ACTIONS[key], locale));
}

/**
 * The 2 × 2 grid beside the hero (two cells in state A). No cell repeats another, and the cells
 * skip the hero's booking button: B's hero already books a stay, so B offers the parent's stays,
 * pets, feedback and profile instead. State A has nothing else to offer until a pet exists, and
 * the C states keep "Prepare", the one job left before the stay, which `resolveQuickActions`
 * points at a page.
 */
export function quickActionsFor(state: HomeState, locale: PortalLocale = 'en'): QuickAction[] {
  switch (state) {
    case 'A':
      return fixedActions(['add-your-pet', 'profile'], locale);
    case 'B1':
    case 'B2':
      return fixedActions(['stays', 'pets', 'feedback', 'profile'], locale);
    case 'C1':
    case 'C2':
      return [
        quickAction('prepare', { icon: 'check', to: '' }, locale),
        ...fixedActions(STAY_FOLLOW_UPS, locale),
      ];
  }
}

/** While pets are staying, the grid leads with their updates instead of booking actions. */
export function quickActionsDuringStay(
  stay: CurrentStay,
  locale: PortalLocale = 'en',
): QuickAction[] {
  return [
    quickAction('live-care', { icon: 'paw', to: liveCareLink(stay) }, locale),
    ...fixedActions(STAY_FOLLOW_UPS, locale),
  ];
}

/**
 * Fills the "Prepare" slot (C states) with the hero booking's first outstanding
 * checklist page. Keyed to the hero only (the soonest stay), not any later
 * booking, so the homepage always points at one clear next action. With nothing
 * left to prepare the slot would only repeat "My stays", so it becomes "My pets".
 */
export function resolveQuickActions(
  state: HomeState,
  upcomingStays: UpcomingStay[],
  currentStay: CurrentStay | null = null,
  locale: PortalLocale = 'en',
): QuickAction[] {
  if (currentStay) return quickActionsDuringStay(currentStay, locale);
  const hero = upcomingStays[0];
  const prepare = hero ? prepareLink(hero.checklist) : null;
  return quickActionsFor(state, locale).map((action) => {
    if (action.key !== 'prepare') return action;
    if (prepare) return { ...action, to: prepare };
    return quickAction('pets', FIXED_QUICK_ACTIONS.pets, locale);
  });
}
