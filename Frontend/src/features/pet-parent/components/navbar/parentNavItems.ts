import type { HomeIconName } from '../home/HomeIcons';
import type { NavbarCopy } from './navbarCopy';

export interface ParentNavItem {
  /** The item's name in NAVBAR_COPY, so it follows the site language. */
  labelKey: keyof NavbarCopy;
  to: string;
  /** Home is current only on `/parent` itself, not on every page beneath it. */
  exact?: boolean;
  /** Other sections that belong to this item, so the item stays marked on their pages too. */
  alsoCurrentOn?: readonly string[];
}

export interface ParentTabItem extends ParentNavItem {
  icon: HomeIconName;
}

const HOME = '/parent';
const STAYS = '/parent/stays';
const BOOKING = '/parent/booking';
const FEEDBACK = '/parent/feedback';
const CHAT = '/parent/ai-chat';
const PROFILE = '/parent/profile';

// Live care and the vaccination form are both opened from a stay, so a parent on them is still
// in "My stays".
const STAY_SECTIONS = ['/parent/live-care', '/parent/vaccination'] as const;

export const DESKTOP_NAV_ITEMS: readonly ParentNavItem[] = [
  { labelKey: 'home', to: HOME, exact: true },
  { labelKey: 'myStays', to: STAYS, alsoCurrentOn: STAY_SECTIONS },
  { labelKey: 'bookAStay', to: BOOKING },
  { labelKey: 'feedback', to: FEEDBACK },
];

// The phone has no room for the header's chat button and account links, so Chat and Profile get
// their own tabs. Feedback stays in the account menu.
export const PHONE_TAB_ITEMS: readonly ParentTabItem[] = [
  { labelKey: 'home', to: HOME, exact: true, icon: 'home' },
  { labelKey: 'staysTab', to: STAYS, alsoCurrentOn: STAY_SECTIONS, icon: 'list' },
  { labelKey: 'bookTab', to: BOOKING, icon: 'calendar' },
  { labelKey: 'chatTab', to: CHAT, icon: 'chat' },
  { labelKey: 'profileTab', to: PROFILE, alsoCurrentOn: ['/parent/pets'], icon: 'user' },
];

function isWithin(pathname: string, section: string): boolean {
  return pathname === section || pathname.startsWith(`${section}/`);
}

/** Whether `pathname` is on the item's own page or one of the pages beneath it. */
export function isNavItemCurrent(pathname: string, item: ParentNavItem): boolean {
  // A trailing slash is the same page to the router, so it must be the same page here too.
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (item.exact) return path === item.to;
  return [item.to, ...(item.alsoCurrentOn ?? [])].some((section) => isWithin(path, section));
}
