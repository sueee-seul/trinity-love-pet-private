/**
 * Section ids for the pet parent account sidebar.
 *
 * Kept out of the component file because the repo lint rule
 * `react(only-export-components)` fails a module that exports both a component
 * and shared constants.
 */
export type ParentProfileTab = 'profile' | 'pets' | 'contacts' | 'updates';

export const PARENT_PROFILE_TABS: readonly ParentProfileTab[] = [
  'profile',
  'pets',
  'contacts',
  'updates',
] as const;

export function isParentProfileTab(value: string | null): value is ParentProfileTab {
  return value !== null && (PARENT_PROFILE_TABS as readonly string[]).includes(value);
}

/** The one list of a pet parent's stays. The account area links to it instead of keeping its own. */
export const PARENT_STAYS_PATH = '/parent/stays';

/**
 * The account area used to have a stays tab of its own. It was a second, disagreeing copy of
 * /parent/stays, so it is gone, and an old link to it is sent to the real list.
 */
export const RETIRED_STAYS_TAB = 'stays';
