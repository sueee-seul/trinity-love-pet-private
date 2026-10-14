import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AccountRoute, PortalRedirect } from './AccountRoute';
import { useAuthStore, type User } from './store/authStore';

const employee: User = {
  id: 'employee-1',
  email: 'employee@example.test',
  is_employee: true,
  is_pet_owner: false,
  employee_role: 'staff',
};

const petOwner: User = {
  id: 'parent-1',
  email: 'parent@example.test',
  is_employee: false,
  is_pet_owner: true,
  employee_role: null,
};

const dualIdentity: User = {
  id: 'dual-1',
  email: 'dual@example.test',
  is_employee: true,
  is_pet_owner: true,
  employee_role: 'manager',
};

const setAuthenticatedUser = (user: User): void => {
  useAuthStore.setState({
    user,
    isAuthenticated: true,
    isHydrating: false,
  });
};

const renderAccountRoute = (path: string): void => {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/admin"
          element={
            <AccountRoute identity="employee">
              <h1>Admin website</h1>
            </AccountRoute>
          }
        />
        <Route
          path="/parent"
          element={
            <AccountRoute identity="pet_owner">
              <h1>Pet Parent website</h1>
            </AccountRoute>
          }
        />
        <Route path="/login" element={<h1>Sign in</h1>} />
        <Route path="/admin/profile" element={<h1>Manager profile</h1>} />
        <Route path="/first-login-password" element={<h1>Set your password</h1>} />
      </Routes>
    </MemoryRouter>,
  );
};

/** "/" with the real routes it can lead to; the front page is a stand-in heading. */
const renderFrontPage = (): void => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<PortalRedirect publicPage={<h1>Wagstay front page</h1>} />} />
        <Route path="/admin" element={<h1>Admin website</h1>} />
        <Route path="/parent" element={<h1>Pet Parent website</h1>} />
        <Route path="/book" element={<h1>Plan your stay</h1>} />
        <Route path="/login" element={<h1>Sign in</h1>} />
        <Route path="/first-login-password" element={<h1>Set your password</h1>} />
      </Routes>
    </MemoryRouter>,
  );
};

describe('account website routing', () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
  });

  it('allows employee accounts into the admin website', () => {
    setAuthenticatedUser(employee);
    renderAccountRoute('/admin');

    expect(screen.getByRole('heading', { name: 'Admin website' })).toBeInTheDocument();
  });

  it('redirects pending employee accounts to first-login password setup', () => {
    setAuthenticatedUser({ ...employee, isUsingTemporaryPassword: true });
    renderAccountRoute('/admin');

    expect(screen.getByRole('heading', { name: 'Set your password' })).toBeInTheDocument();
  });

  it('redirects a pet owner away from the admin website', () => {
    setAuthenticatedUser(petOwner);
    renderAccountRoute('/admin');

    expect(screen.getByRole('heading', { name: 'Pet Parent website' })).toBeInTheDocument();
  });

  it('keeps an employee out of the pet parent website even when flagged as an owner', () => {
    setAuthenticatedUser(dualIdentity);

    renderAccountRoute('/parent');
    // Staff who want to board their own pet register a separate pet parent
    // account; a staff sign-in never crosses over.
    expect(screen.getByRole('heading', { name: 'Admin website' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Pet Parent website' })).not.toBeInTheDocument();
  });

  it('still lets that account use the admin website it belongs to', () => {
    setAuthenticatedUser(dualIdentity);

    renderAccountRoute('/admin');
    expect(screen.getByRole('heading', { name: 'Admin website' })).toBeInTheDocument();
  });

  it('defaults an authenticated dual-identity account to the admin website', () => {
    setAuthenticatedUser(dualIdentity);
    renderFrontPage();

    expect(screen.getByRole('heading', { name: 'Admin website' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Wagstay front page' })).not.toBeInTheDocument();
  });

  it('shows the public front page to a visitor without a session, with no redirect', () => {
    renderFrontPage();

    expect(screen.getByRole('heading', { name: 'Wagstay front page' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Plan your stay' })).not.toBeInTheDocument();
  });

  it('shows the public front page to a signed-in pet owner instead of sending them to /parent', () => {
    setAuthenticatedUser(petOwner);
    renderFrontPage();

    expect(screen.getByRole('heading', { name: 'Wagstay front page' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Pet Parent website' })).not.toBeInTheDocument();
  });

  it('shows the public front page while the session is still loading, not a blank screen', () => {
    useAuthStore.setState({ user: null, isAuthenticated: false, isHydrating: true });
    renderFrontPage();

    expect(screen.getByRole('heading', { name: 'Wagstay front page' })).toBeInTheDocument();
  });

  it('sends staff on to the admin website once their session has loaded', () => {
    useAuthStore.setState({ user: null, isAuthenticated: false, isHydrating: true });
    renderFrontPage();
    expect(screen.getByRole('heading', { name: 'Wagstay front page' })).toBeInTheDocument();

    act(() => {
      useAuthStore.getState().login(employee);
    });

    expect(screen.getByRole('heading', { name: 'Admin website' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Wagstay front page' })).not.toBeInTheDocument();
  });

  it('defaults a pending employee account to first-login password setup', () => {
    setAuthenticatedUser({ ...employee, isUsingTemporaryPassword: true });
    renderFrontPage();

    expect(screen.getByRole('heading', { name: 'Set your password' })).toBeInTheDocument();
  });

  it('sends an account that is neither staff nor a pet owner to sign in', () => {
    setAuthenticatedUser({ ...petOwner, is_pet_owner: false });
    renderFrontPage();

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });
});
