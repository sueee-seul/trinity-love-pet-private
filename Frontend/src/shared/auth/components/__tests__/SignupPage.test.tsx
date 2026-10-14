import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SignupPage } from '../SignupPage';
import { chooseDate, getCalendarDayButton } from '../../../components/ui/date/testing';

const renderSignup = (): void => {
  render(
    <MemoryRouter initialEntries={['/signup']}>
      <Routes>
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/login" element={<h1>Sign in</h1>} />
      </Routes>
    </MemoryRouter>,
  );
};

const queueBackendResponse = (ok: boolean, body: Record<string, unknown>): void => {
  (globalThis.fetch as Mock).mockResolvedValueOnce({
    ok,
    json: async () => body,
  });
};

const queueValidResponse = (): void => {
  queueBackendResponse(true, {
    code: 200,
    msg: 'Signup validation passed',
    data: { valid: true, fieldErrors: {} },
  });
};

const queueCreationResponse = (): void => {
  queueBackendResponse(true, {
    code: 201,
    msg: 'Account created',
    data: {
      user: {
        email: 'parent@example.com',
        name: 'David Parent',
        is_employee: false,
        is_pet_owner: true,
      },
    },
  });
};

const fillValidAccount = (): void => {
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: 'parent@example.com' },
  });
  fireEvent.change(screen.getByLabelText('Username'), {
    target: { value: 'parent' },
  });
  fireEvent.change(screen.getByLabelText('Choose your password'), {
    target: { value: 'Sunrise1!' },
  });
  fireEvent.change(screen.getByLabelText('Re-enter your password'), {
    target: { value: 'Sunrise1!' },
  });
};

const fillValidProfile = async (): Promise<void> => {
  fireEvent.change(screen.getByLabelText('Emergency contact number (optional)'), {
    target: { value: '+64 21 555 0000' },
  });
  fireEvent.change(screen.getByLabelText('First name'), {
    target: { value: 'David' },
  });
  fireEvent.change(screen.getByLabelText('Last name'), {
    target: { value: 'Parent' },
  });
  fireEvent.change(screen.getByLabelText('Address (optional)'), {
    target: { value: '1 New Street, Auckland' },
  });
  await chooseDate(
    userEvent.setup(),
    screen.getByRole('button', { name: 'Date of birth (optional)' }),
    '1990-01-01',
  );
};

describe('SignupPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('renders the Pet Parent account step with the Login visual context', () => {
    renderSignup();

    expect(screen.getByRole('heading', { name: 'Create account' })).toBeInTheDocument();
    expect(screen.getByText('Pet Parent Portal')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByLabelText('Choose your password')).toBeInTheDocument();
    expect(screen.getByLabelText('Re-enter your password')).toBeInTheDocument();
    expect(screen.queryByText(/staff/i)).not.toBeInTheDocument();
  });

  it('displays Backend field errors for an incomplete account step', async () => {
    queueBackendResponse(false, {
      code: 400,
      msg: 'Signup validation failed',
      data: {
        valid: false,
        fieldErrors: {
          email: [{ code: 'EMAIL_REQUIRED', message: 'Enter an email.' }],
          username: [{ code: 'USERNAME_REQUIRED', message: 'Choose a username.' }],
          password: [{ code: 'PASSWORD_REQUIRED', message: 'Choose a password.' }],
          confirmPassword: [
            { code: 'CONFIRM_PASSWORD_REQUIRED', message: 'Re-enter your password.' },
          ],
        },
      },
    });
    renderSignup();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => {
      expect(screen.getByText('Enter an email.')).toBeInTheDocument();
      expect(screen.getByText('Choose a username.')).toBeInTheDocument();
      expect(screen.getByText('Choose a password.')).toBeInTheDocument();
      expect(screen.getByText('Re-enter your password.')).toBeInTheDocument();
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/signup/validate'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('displays separate Backend password errors for missing number and symbol', async () => {
    renderSignup();
    fillValidAccount();
    queueBackendResponse(false, {
      code: 400,
      msg: 'Signup validation failed',
      data: {
        valid: false,
        fieldErrors: {
          password: [
            {
              code: 'PASSWORD_MISSING_NUMBER',
              message: 'Password must contain at least one number.',
            },
            {
              code: 'PASSWORD_MISSING_SYMBOL',
              message: 'Password must contain at least one symbol.',
            },
          ],
        },
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => {
      expect(screen.getByText('Password must contain at least one number.')).toBeInTheDocument();
      expect(screen.getByText('Password must contain at least one symbol.')).toBeInTheDocument();
    });
  });

  it('does not perform local password validation before sending the Backend request', async () => {
    renderSignup();
    fillValidAccount();
    queueValidResponse();

    fireEvent.change(screen.getByLabelText('Choose your password'), {
      target: { value: 'short' },
    });
    fireEvent.change(screen.getByLabelText('Re-enter your password'), {
      target: { value: 'short' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Tell us about you' })).toBeInTheDocument();
    });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('renders the profile step after Backend account validation succeeds', async () => {
    renderSignup();
    fillValidAccount();
    queueValidResponse();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Tell us about you' })).toBeInTheDocument();
    });
    expect(screen.getByLabelText('Emergency contact number (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('First name')).toBeInTheDocument();
    expect(screen.getByLabelText('Last name')).toBeInTheDocument();
    expect(screen.getByLabelText('Address (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Date of birth (optional)')).toBeInTheDocument();
    expect(screen.queryByText('Choose your avatar')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Bio (optional)')).not.toBeInTheDocument();
  });

  it('offers no date of birth after today', async () => {
    // Only Date is faked, so user-event and waitFor keep their real timers.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 28, 12));
    const user = userEvent.setup();
    renderSignup();
    fillValidAccount();
    queueValidResponse();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Tell us about you' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Date of birth (optional)' }));

    expect(getCalendarDayButton('2026-09-28')).toBeEnabled();
    expect(getCalendarDayButton('2026-09-29')).toBeDisabled();
  });

  it('displays Backend profile errors without local validation', async () => {
    renderSignup();
    fillValidAccount();
    queueValidResponse();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Tell us about you' })).toBeInTheDocument();
    });

    await fillValidProfile();
    queueBackendResponse(false, {
      code: 400,
      msg: 'Signup validation failed',
      data: {
        valid: false,
        fieldErrors: {
          dateOfBirth: [
            { code: 'DOB_IN_FUTURE', message: 'Date of birth cannot be in the future.' },
          ],
          address: [{ code: 'ADDRESS_REQUIRED', message: 'Enter your address.' }],
        },
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => {
      expect(screen.getByText('Date of birth cannot be in the future.')).toBeInTheDocument();
      expect(screen.getByText('Enter your address.')).toBeInTheDocument();
    });
  });

  it('creates the account after Backend profile validation succeeds', async () => {
    renderSignup();
    fillValidAccount();
    queueValidResponse();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Tell us about you' })).toBeInTheDocument();
    });

    await fillValidProfile();
    queueValidResponse();
    queueCreationResponse();
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    });
  });

  it('shows a network error when Backend validation cannot be reached', async () => {
    renderSignup();
    fillValidAccount();
    (globalThis.fetch as Mock).mockRejectedValueOnce(new Error('Network unavailable'));

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => {
      expect(
        screen.getByText('Unable to validate signup right now. Please try again.'),
      ).toBeInTheDocument();
    });
  });

  it('returns to the sign-in route from the first step', () => {
    renderSignup();

    fireEvent.click(screen.getByRole('button', { name: 'Back to sign in' }));

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });
});
