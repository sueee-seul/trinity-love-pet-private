import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { authApi } from './shared/auth/api/authApi';
import { useAuthStore } from './shared/auth/store/authStore';

describe('App standalone maps review route', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/maps/place/PetHouse/');
    useAuthStore.getState().logout();
    vi.spyOn(authApi, 'getCurrentUser').mockResolvedValue({ ok: false, data: {} });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.history.pushState({}, '', '/');
  });

  it('renders the PetHouse page without requiring an authenticated account', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'PetHouse' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Sign in' })).not.toBeInTheDocument();
  });
});

describe('App removed step-by-step booking route', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/parent/booking/classic');
    // As on a real page load: the session is still being read, so the portal does not redirect.
    useAuthStore.getState().logout();
    useAuthStore.getState().setHydrating(true);
    vi.spyOn(authApi, 'getCurrentUser').mockResolvedValue({
      ok: true,
      data: {
        data: {
          user: {
            id: 'owner-1',
            email: 'owner@example.test',
            name: 'Owner One',
            is_employee: false,
            is_pet_owner: true,
            employee_role: null,
          },
        },
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.history.pushState({}, '', '/');
  });

  it('no longer opens the old form that asked a signed-in pet parent for card details', async () => {
    render(<App />);

    // The pet parent is signed in, so only the missing route can keep the old form away.
    await waitFor(() => expect(useAuthStore.getState().user?.is_pet_owner).toBe(true));
    // Let React render the signed-in routes before looking for what they show.
    await act(async () => {});
    expect(window.location.pathname).toBe('/parent/booking/classic');
    expect(screen.queryByRole('heading', { name: 'Boarding dates' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/card number/i)).not.toBeInTheDocument();
  });
});
