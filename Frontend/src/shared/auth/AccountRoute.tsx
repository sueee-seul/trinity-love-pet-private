import React from 'react';
import { Navigate } from 'react-router-dom';
import { isPetParentAccount, type AccountIdentity } from './accountIdentity';
import { useAuthStore } from './store/authStore';

export type { AccountIdentity };

interface AccountRouteProps {
  identity: AccountIdentity;
  children: React.ReactElement;
}

const fallbackPathFor = (
  identity: AccountIdentity,
  is_employee: boolean,
  is_pet_owner: boolean,
): string => {
  // An employee is sent to their own side first: being flagged as a pet owner
  // too no longer opens the parent website to them.
  if (is_employee) {
    return identity === 'employee' ? '/login' : '/admin';
  }
  if (identity === 'employee' && is_pet_owner) {
    return '/parent';
  }
  return '/login';
};

export const AccountRoute: React.FC<AccountRouteProps> = ({ identity, children }) => {
  const { isAuthenticated, isHydrating, user } = useAuthStore();

  if (isHydrating) {
    return null;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // An employee account cannot cross into the pet parent website, even when
  // `is_pet_owner` is also set on it. Staff who want to board their own pet
  // register a separate pet parent account: one sign-in is one side of the
  // product, so a staff session can never be holding a parent's records.
  const allowed = identity === 'employee' ? user.is_employee : isPetParentAccount(user);
  if (allowed) {
    if (identity === 'employee' && user.isUsingTemporaryPassword === true) {
      return <Navigate to="/first-login-password" replace />;
    }
    return children;
  }

  return <Navigate to={fallbackPathFor(identity, user.is_employee, user.is_pet_owner)} replace />;
};

interface PortalRedirectProps {
  /**
   * The public front page. Passed in rather than imported, so the shared auth layer never depends
   * on a feature.
   */
  publicPage: React.ReactElement;
}

/**
 * What "/" shows. Guests and signed-in pet parents get the public page; a pet parent reaches their
 * pet centre from its header. Staff go straight to their own side.
 *
 * While the session is still being read, the public page is shown too, with its guest header,
 * instead of a blank screen. It is the same element in both states, so it is not remounted when
 * the session arrives. A staff member sees it only for that loading moment, then is redirected.
 */
export const PortalRedirect: React.FC<PortalRedirectProps> = ({ publicPage }) => {
  const { isAuthenticated, isHydrating, user } = useAuthStore();

  if (isHydrating || !isAuthenticated || !user) {
    return publicPage;
  }

  if (user.is_employee) {
    if (user.isUsingTemporaryPassword === true) {
      return <Navigate to="/first-login-password" replace />;
    }
    return <Navigate to="/admin" replace />;
  }

  if (isPetParentAccount(user)) {
    return publicPage;
  }

  return <Navigate to="/login" replace />;
};
