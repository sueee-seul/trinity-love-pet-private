import { isPetParentAccount } from '../../auth/accountIdentity';
import { useAuthStore } from '../../auth/store/authStore';

/**
 * The pet parent's Account Settings, with the flag `ProfilePage` reads to open the panel on
 * arrival rather than landing the visitor on the profile and making them find it.
 */
export const PET_PARENT_APPEARANCE_PATH = '/parent/profile?settings=open';

/** The staff profile's Settings tab, opened directly rather than on the profile overview. */
export const STAFF_APPEARANCE_PATH = '/admin/profile?tab=settings';

/**
 * Where the toolbar's appearance control should send this visitor, or `null` when it should open
 * the inline panel instead.
 *
 * Each role has its own settings surface and is sent to that one, because the two sides of the
 * product do not share a route: `/parent/profile` sits behind `AccountRoute identity="pet_owner"`
 * and `/admin/profile` behind `identity="employee"`, so a link to the wrong one bounces the
 * visitor the instant they arrive.
 *
 * A signed-out visitor has no settings page at all, so they keep the inline panel. That is what
 * keeps the reading colour modes reachable on the login page.
 *
 * The pet parent predicate is imported from the guard rather than restated here: a copy would let
 * the button and the route disagree, and that failure is silent until someone presses it.
 *
 * Both employee roles share `/admin/profile`, which renders Platform Settings for a manager and
 * the Settings tab for staff, so one destination covers them.
 */
export const useAppearanceDestination = (): string | null => {
  const isHydrating = useAuthStore((state) => state.isHydrating);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);

  // Identity is not known yet. The panel always works, so it is the safe answer while waiting.
  if (isHydrating || !isAuthenticated || !user) {
    return null;
  }

  if (isPetParentAccount(user)) {
    return PET_PARENT_APPEARANCE_PATH;
  }

  return user.is_employee ? STAFF_APPEARANCE_PATH : null;
};
