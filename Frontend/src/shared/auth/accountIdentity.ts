import type { User } from './store/authStore';

export type AccountIdentity = 'employee' | 'pet_owner';

/**
 * Whether this account may enter the pet parent website.
 *
 * Kept here rather than beside the route guard that uses it, because anything linking into
 * `/parent/*` has to agree with that guard: a copy of the rule would let a button and the route
 * disagree, and that failure is silent until someone presses it.
 *
 * Its own module, and not `AccountRoute.tsx`, because a file that exports both components and
 * plain functions breaks React Fast Refresh - `react(only-export-components)`, which the
 * Frontend's oxlint pass fails on.
 *
 * An employee account is excluded even when `is_pet_owner` is also set: staff who board their own
 * pet register a separate pet parent account, so one sign-in is one side of the product.
 */
export const isPetParentAccount = (user: Pick<User, 'is_employee' | 'is_pet_owner'>): boolean =>
  user.is_pet_owner && !user.is_employee;
