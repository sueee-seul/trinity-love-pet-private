import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AccessibilityWidget } from '../components/AccessibilityWidget';
import { DEFAULT_PREFERENCES } from '../preferences';
import { useAccessibilityStore } from '../store/accessibilityStore';
import { useAuthStore, type User } from '../../auth/store/authStore';
import { UNTHEMED_BRAND_THEME } from '../../theme/constants';
import { useBrandThemeStore } from '../../theme/themeStore';

/**
 * Where the toolbar's Theme control takes each kind of visitor.
 *
 * The rule is the route guard's, not the toolbar's: only an account that `AccountRoute
 * identity="pet_owner"` would admit is given a link, because anyone else is bounced the instant
 * they arrive. Everyone else opens the panel, which is why the reading colour modes stay
 * reachable for staff, managers and signed-out visitors.
 */

const LocationProbe: React.FC = () => {
  const location = useLocation();
  return <span data-testid="location">{`${location.pathname}${location.search}`}</span>;
};

const renderAt = (): void => {
  render(
    <MemoryRouter initialEntries={['/parent']}>
      <AccessibilityWidget />
      <Routes>
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
};

const signIn = (user: User): void => {
  useAuthStore.getState().login(user);
};

const PET_PARENT: User = { email: 'parent@example.com', is_employee: false, is_pet_owner: true };
const STAFF: User = {
  email: 'staff@example.com',
  is_employee: true,
  is_pet_owner: false,
  employee_role: 'staff',
};
const MANAGER: User = {
  email: 'manager@example.com',
  is_employee: true,
  is_pet_owner: false,
  employee_role: 'manager',
};
/**
 * An employee flagged as a pet owner too. The guard still refuses them the parent website, so the
 * toolbar has to send them to the employee side. This is the case a hand-written `is_pet_owner`
 * check in the toolbar would have got wrong.
 */
const EMPLOYEE_WHO_ALSO_OWNS_A_PET: User = {
  email: 'both@example.com',
  is_employee: true,
  is_pet_owner: true,
  employee_role: 'staff',
};

const openAppearanceControl = (): void => {
  fireEvent.click(screen.getByTestId('accessibility-launcher'));
  fireEvent.click(screen.getByLabelText('Themes and reading colours'));
};

describe('appearance control destination', () => {
  beforeEach(() => {
    useAccessibilityStore.setState({ ...DEFAULT_PREFERENCES, isToolbarOpen: false });
    useAuthStore.getState().logout();
    window.localStorage.clear();
    useBrandThemeStore.setState({ theme: UNTHEMED_BRAND_THEME, hasChosen: false });
    delete document.documentElement.dataset.theme;
  });

  it('sends a pet parent to Account Settings with the panel flag', () => {
    signIn(PET_PARENT);
    renderAt();

    openAppearanceControl();

    expect(screen.getByTestId('location')).toHaveTextContent('/parent/profile?settings=open');
  });

  // The bar is full width. Left open it would sit over the settings panel the visitor was just
  // sent to, which is the one thing they went there to use.
  it('collapses the bar when it navigates', () => {
    signIn(PET_PARENT);
    renderAt();

    openAppearanceControl();

    expect(screen.queryByTestId('accessibility-toolbar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('accessibility-appearance-panel')).not.toBeInTheDocument();
  });

  it('sends a staff member to their own profile Settings tab', () => {
    signIn(STAFF);
    renderAt();

    openAppearanceControl();

    expect(screen.getByTestId('location')).toHaveTextContent('/admin/profile?tab=settings');
  });

  // The guard refuses the parent website to an employee even when `is_pet_owner` is set, so the
  // employee destination is the only one that does not bounce them.
  it('sends an employee who also owns a pet to the employee settings, not the parent page', () => {
    signIn(EMPLOYEE_WHO_ALSO_OWNS_A_PET);
    renderAt();

    openAppearanceControl();

    expect(screen.getByTestId('location')).toHaveTextContent('/admin/profile?tab=settings');
  });

  // Both employee roles share /admin/profile, so a manager is sent to the same place as staff.
  it('sends a manager to the employee settings like any other employee', () => {
    signIn(MANAGER);
    renderAt();

    openAppearanceControl();

    expect(screen.getByTestId('location')).toHaveTextContent('/admin/profile?tab=settings');
  });

  it('opens the panel for a signed-out visitor, keeping reading colours on the login page', () => {
    renderAt();

    openAppearanceControl();

    expect(screen.getByTestId('accessibility-appearance-panel')).toBeInTheDocument();
  });

  // Identity is unknown during hydration. Navigating on a guess would throw the visitor off the
  // page they are on, so the panel is the answer until the store settles.
  it('opens the panel while the session is still hydrating', () => {
    useAuthStore.setState({ isHydrating: true, isAuthenticated: false, user: null });
    renderAt();

    openAppearanceControl();

    expect(screen.getByTestId('accessibility-appearance-panel')).toBeInTheDocument();
  });

  // A button that navigates does not own a panel, and saying otherwise tells a screen reader to
  // expect something that never appears.
  it('only advertises the panel relationship on the branch that has one', () => {
    signIn(PET_PARENT);
    renderAt();
    fireEvent.click(screen.getByTestId('accessibility-launcher'));

    expect(screen.getByLabelText('Themes and reading colours')).not.toHaveAttribute(
      'aria-expanded',
    );
  });
});
