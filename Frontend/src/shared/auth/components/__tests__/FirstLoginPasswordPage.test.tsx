import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FirstLoginPasswordPage, ResetPasswordPage } from '../FirstLoginPasswordPage';
import { authApi } from '../../api/authApi';
import { useAuthStore } from '../../store/authStore';

vi.mock('../../api/authApi', () => ({
  authApi: {
    completeTemporaryPassword: vi.fn(),
    completePasswordReset: vi.fn(),
  },
}));

const completeTemporaryPassword = vi.mocked(authApi.completeTemporaryPassword);
const completePasswordReset = vi.mocked(authApi.completePasswordReset);

describe('FirstLoginPasswordPage', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: {
        id: 'employee-1',
        email: 'staff@example.test',
        name: 'Staff Member',
        is_employee: true,
        is_pet_owner: false,
        employee_role: 'staff',
        isUsingTemporaryPassword: true,
      },
      isAuthenticated: true,
      isHydrating: false,
    });
    completeTemporaryPassword.mockReset();
    completePasswordReset.mockReset();
  });

  it('requires a pending employee to set a new password before entering the admin website', async () => {
    const user = userEvent.setup();
    completeTemporaryPassword.mockResolvedValue({
      ok: true,
      data: { data: { passwordChanged: true } },
    });

    render(
      <MemoryRouter initialEntries={['/first-login-password']}>
        <Routes>
          <Route path="/first-login-password" element={<FirstLoginPasswordPage />} />
          <Route path="/admin" element={<h1>Admin website</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Set your password' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('New password'), 'NewSecure1!');
    await user.type(screen.getByLabelText('Confirm new password'), 'NewSecure1!');
    await user.click(screen.getByRole('button', { name: 'Set password and continue' }));

    expect(completeTemporaryPassword).toHaveBeenCalledWith('NewSecure1!', 'NewSecure1!');
    expect(await screen.findByRole('heading', { name: 'Admin website' })).toBeInTheDocument();
    expect(useAuthStore.getState().user?.isUsingTemporaryPassword).toBe(false);
  });

  it('shows the server error and keeps the user on the password page', async () => {
    const user = userEvent.setup();
    completeTemporaryPassword.mockResolvedValue({
      ok: false,
      data: { msg: 'Password update failed', data: null },
    });

    render(
      <MemoryRouter initialEntries={['/first-login-password']}>
        <Routes>
          <Route path="/first-login-password" element={<FirstLoginPasswordPage />} />
          <Route path="/admin" element={<h1>Admin website</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('New password'), 'NewSecure1!');
    await user.type(screen.getByLabelText('Confirm new password'), 'NewSecure1!');
    await user.click(screen.getByRole('button', { name: 'Set password and continue' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Password update failed');
    expect(screen.queryByRole('heading', { name: 'Admin website' })).not.toBeInTheDocument();
  });

  const renderFirstLogin = (): void => {
    render(
      <MemoryRouter initialEntries={['/first-login-password']}>
        <Routes>
          <Route path="/first-login-password" element={<FirstLoginPasswordPage />} />
          <Route path="/admin" element={<h1>Admin website</h1>} />
        </Routes>
      </MemoryRouter>,
    );
  };

  it('lists the password rules and ticks each one as it is met', async () => {
    const user = userEvent.setup();
    renderFirstLogin();

    expect(screen.getByText('8 to 32 characters')).toBeInTheDocument();
    expect(screen.getByText('At least one number')).toBeInTheDocument();
    expect(screen.getByText('At least one symbol, such as ! @ # or ?')).toBeInTheDocument();
    expect(screen.getByText('No space at the start or end')).toBeInTheDocument();
    expect(screen.getByText('Both passwords match')).toBeInTheDocument();
    expect(screen.getAllByText('(not yet)', { exact: false })).toHaveLength(5);

    await user.type(screen.getByLabelText('New password'), 'NewSecure1!');
    await user.type(screen.getByLabelText('Confirm new password'), 'NewSecure1!');

    expect(screen.getAllByText('(done)', { exact: false })).toHaveLength(5);
  });

  it('stops a password that misses a rule before it reaches the server', async () => {
    const user = userEvent.setup();
    renderFirstLogin();

    await user.type(screen.getByLabelText('New password'), 'NewSecure1');
    await user.type(screen.getByLabelText('Confirm new password'), 'NewSecure1');
    await user.click(screen.getByRole('button', { name: 'Set password and continue' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your password does not meet every requirement in the list yet.',
    );
    expect(completeTemporaryPassword).not.toHaveBeenCalled();
  });

  it('shows the rule the server rejected instead of a generic error', async () => {
    const user = userEvent.setup();
    completeTemporaryPassword.mockResolvedValue({
      ok: false,
      data: {
        msg: 'Password validation failed',
        data: {
          fieldErrors: {
            password: [
              {
                code: 'PASSWORD_PERSONAL_INFORMATION',
                message: 'Password should not include your personal information.',
              },
            ],
          },
        },
      },
    });
    renderFirstLogin();

    await user.type(screen.getByLabelText('New password'), 'NewSecure1!');
    await user.type(screen.getByLabelText('Confirm new password'), 'NewSecure1!');
    await user.click(screen.getByRole('button', { name: 'Set password and continue' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Password should not include your personal information.',
    );
  });

  it('uses the same password page for a reset token and returns to sign in', async () => {
    const user = userEvent.setup();
    completePasswordReset.mockResolvedValue({
      ok: true,
      data: { data: { passwordChanged: true } },
    });

    render(
      <MemoryRouter initialEntries={['/reset-password?token=reset-token']}>
        <Routes>
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/login" element={<h1>Sign in</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Set your password' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('New password'), 'NewSecure1!');
    await user.type(screen.getByLabelText('Confirm new password'), 'NewSecure1!');
    await user.click(screen.getByRole('button', { name: 'Reset password' }));

    expect(completePasswordReset).toHaveBeenCalledWith('reset-token', 'NewSecure1!', 'NewSecure1!');
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(useAuthStore.getState().user?.isUsingTemporaryPassword).toBe(true);
  });
});
