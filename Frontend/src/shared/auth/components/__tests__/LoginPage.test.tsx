import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, fireEvent, waitFor, type RenderResult } from '@testing-library/react';
import { BrowserRouter, MemoryRouter, Route, Routes } from 'react-router-dom';
import { LoginPage } from '../LoginPage';
import { ForgotPasswordPage } from '../ForgotPasswordPage';
import { useAuthStore } from '../../store/authStore';
import { BRAND_MARK_SRC } from '../../../brand/BrandMark';

// Mock global fetch
globalThis.fetch = vi.fn();

describe('LoginPage Validations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().logout();
  });

  const renderWithRouter = (ui: React.ReactElement): RenderResult => {
    return render(<BrowserRouter>{ui}</BrowserRouter>);
  };

  it('shows the fixed Wagstay paw beside the brand heading', () => {
    (globalThis.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { clientId: 'mock-id' } }),
    });

    renderWithRouter(<LoginPage />);

    const brand = screen.getByRole('heading', { level: 1, name: 'Wagstay' });
    expect(brand.querySelector(`img[src="${BRAND_MARK_SRC}"][alt=""]`)).not.toBeNull();
  });

  // Regression: the press and hit motion hangs on `theme-gradient-action`, and this button was
  // left without it, so it was the one primary button on the page that did not move.
  it('gives the Next button the primary button press motion', () => {
    (globalThis.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { clientId: 'mock-id' } }),
    });

    renderWithRouter(<LoginPage />);

    expect(screen.getByRole('button', { name: 'Next' })).toHaveClass('theme-gradient-action');
  });

  it('shows error when email format is invalid', async () => {
    // Mock config fetch success to avoid console errors
    (globalThis.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { clientId: 'mock-id' } }),
    });

    renderWithRouter(<LoginPage />);

    const emailInput = screen.getByLabelText('Email');
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });

    const nextBtn = screen.getByText('Next');
    fireEvent.click(nextBtn);

    expect(screen.getByText('Please enter a valid email address.')).toBeInTheDocument();

    // Fetch should only have been called for config, not check-email
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect((globalThis.fetch as Mock).mock.calls[0][0]).toContain('/api/auth/google/config');
  });

  it('shows error when email is not registered (API returns 404)', async () => {
    // Mock config fetch
    (globalThis.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { clientId: 'mock-id' } }),
    });
    // Mock check-email fetch
    (globalThis.fetch as Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        msg: 'Email not registered.',
      }),
    });

    renderWithRouter(<LoginPage />);

    const emailInput = screen.getByLabelText('Email');
    fireEvent.change(emailInput, { target: { value: 'notfound@example.com' } });

    const nextBtn = screen.getByText('Next');
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
      expect(screen.getByText('Email not registered.')).toBeInTheDocument();
    });
  });

  it('progresses to password step when email is registered (API returns 200)', async () => {
    // Both config and check-email return ok: true
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        msg: 'Success',
        data: { clientId: 'dummy', email: 'manager@wagstay.com' },
      }),
    });

    renderWithRouter(<LoginPage />);

    const emailInput = screen.getByLabelText('Email');
    fireEvent.change(emailInput, { target: { value: 'manager@wagstay.com' } });

    const nextBtn = screen.getByText('Next');
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(screen.getByLabelText('Enter your password')).toBeInTheDocument();
    });
  });

  it('starts with the email a page handed over and returns there after a parent signs in', async () => {
    (globalThis.fetch as Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { clientId: 'dummy' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ msg: 'Success', data: { email: 'hana.kowalski@example.test' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            user: {
              id: 'owner-1',
              email: 'hana.kowalski@example.test',
              name: 'Hana',
              is_employee: false,
              is_pet_owner: true,
              employee_role: null,
            },
          },
        }),
      });

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/login',
            state: { email: 'hana.kowalski@example.test', returnTo: '/book?step=verify' },
          },
        ]}
      >
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/book" element={<h1>Booking page</h1>} />
          <Route path="/parent" element={<h1>Portal home</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByLabelText('Email')).toHaveValue('hana.kowalski@example.test');
    fireEvent.click(screen.getByText('Next'));
    await waitFor(() => {
      expect(screen.getByLabelText('Enter your password')).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText('Enter your password'), {
      target: { value: 'Password#1' },
    });
    fireEvent.click(screen.getByText('Next'));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Booking page' })).toBeInTheDocument();
    });
  });

  it('shows the backend password error after sending the login request', async () => {
    (globalThis.fetch as Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { clientId: 'dummy' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          msg: 'Success',
          data: { email: 'manager@wagstay.com' },
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ msg: 'Wrong password. Try again.' }),
      });

    renderWithRouter(<LoginPage />);

    // Progress to password step
    const emailInput = screen.getByLabelText('Email');
    fireEvent.change(emailInput, { target: { value: 'manager@wagstay.com' } });
    fireEvent.click(screen.getByText('Next'));

    await waitFor(() => {
      expect(screen.getByLabelText('Enter your password')).toBeInTheDocument();
    });

    // The Backend owns password acceptance; LoginPage sends the value unchanged.
    const passwordInput = screen.getByLabelText('Enter your password');
    fireEvent.change(passwordInput, { target: { value: 'short' } });
    fireEvent.click(screen.getByText('Next'));

    await waitFor(() => {
      expect(screen.getByText('Wrong password. Try again.')).toBeInTheDocument();
    });

    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
  });

  it('toggles password visibility when eye icon is clicked', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        msg: 'Success',
        data: { clientId: 'dummy', email: 'manager@wagstay.com' },
      }),
    });

    renderWithRouter(<LoginPage />);

    // Progress to password step
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'manager@wagstay.com' } });
    fireEvent.click(screen.getByText('Next'));

    await waitFor(() => {
      expect(screen.getByLabelText('Enter your password')).toBeInTheDocument();
    });

    const passwordInput = screen.getByLabelText('Enter your password');
    expect(passwordInput).toHaveAttribute('type', 'password');

    // Click toggle
    const toggleBtn = screen.getByRole('button', { name: 'Show password' });
    fireEvent.click(toggleBtn);

    expect(passwordInput).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toBeInTheDocument();
  });

  it('navigates to the signup page from Create account', async () => {
    (globalThis.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { clientId: 'mock-id' } }),
    });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<h1>Pet Parent signup</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(screen.getByRole('heading', { name: 'Pet Parent signup' })).toBeInTheDocument();
  });

  it('goes back to the front page from Back to home', async () => {
    (globalThis.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { clientId: 'mock-id' } }),
    });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<h1>Wagstay front page</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('link', { name: 'Back to home' }));

    expect(screen.getByRole('heading', { name: 'Wagstay front page' })).toBeInTheDocument();
  });

  it('offers no "Forgot email?" link, since nothing can recover an email yet', async () => {
    (globalThis.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { clientId: 'mock-id' } }),
    });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Back to home' })).toBeInTheDocument();
    expect(screen.queryByText('Forgot email?')).not.toBeInTheDocument();
  });

  it('connects Forgot password to the recovery page with the current email', async () => {
    (globalThis.fetch as Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { clientId: 'dummy', email: 'staff@example.test' } }),
    });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'staff@example.test' },
    });
    fireEvent.click(screen.getByText('Next'));
    await waitFor(() => {
      expect(screen.getByLabelText('Enter your password')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));

    expect(await screen.findByRole('heading', { name: 'Forgot password?' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveValue('staff@example.test');
  });

  it('shows the generic recovery message and local reset link after a reset request', async () => {
    (globalThis.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        code: 200,
        msg: 'If the account exists, a reset link has been prepared.',
        data: { resetUrl: 'http://localhost:5173/reset-password?token=test-token' },
      }),
    });

    render(
      <MemoryRouter initialEntries={['/forgot-password']}>
        <Routes>
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'staff@example.test' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        'If the account exists, a reset link has been prepared. Check your email.',
      );
    });
    expect(screen.getByRole('link', { name: 'Continue to reset password' })).toHaveAttribute(
      'href',
      'http://localhost:5173/reset-password?token=test-token',
    );
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/password-reset/request'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'staff@example.test' }),
      }),
    );
  });

  it('renders a success notice after signup or password reset', async () => {
    (globalThis.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { clientId: 'mock-id' } }),
    });

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/login',
            state: {
              notice: { type: 'success', kind: 'passwordReset' },
            },
          },
        ]}
      >
        <Routes>
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Password reset successfully. You can now sign in.',
    );
  });

  it('routes a pending employee to first-login password setup after authentication', async () => {
    (globalThis.fetch as Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { clientId: 'mock-id' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { email: 'staff@example.test' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          msg: 'Login successful',
          data: {
            user: {
              id: 'employee-1',
              email: 'staff@example.test',
              name: 'Staff Member',
              is_employee: true,
              is_pet_owner: false,
              employee_role: 'staff',
              isUsingTemporaryPassword: true,
            },
          },
        }),
      });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/first-login-password" element={<h1>Set your password</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'staff@example.test' },
    });
    fireEvent.click(screen.getByText('Next'));
    await waitFor(() => {
      expect(screen.getByLabelText('Enter your password')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Enter your password'), {
      target: { value: 'Temporary1!' },
    });
    fireEvent.click(screen.getByText('Next'));

    expect(await screen.findByRole('heading', { name: 'Set your password' })).toBeInTheDocument();
  });

  it('says Google sign-in is not set up when the Backend has no client ID', async () => {
    (globalThis.fetch as Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ code: 503, msg: 'Google sign-in is not configured', data: null }),
    });

    renderWithRouter(<LoginPage />);

    expect(await screen.findByText('Google sign-in is not set up yet')).toBeInTheDocument();
    expect(screen.queryByText('Loading Google...')).not.toBeInTheDocument();
  });
});
