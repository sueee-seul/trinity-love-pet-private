import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SignupPage } from '../SignupPage';
import { chooseDate } from '../../../components/ui/date/testing';
import { LoginPage } from '../LoginPage';

const renderSignup = (): void => {
  render(
    <MemoryRouter initialEntries={['/signup']}>
      <Routes>
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/login" element={<LoginPage />} />
      </Routes>
    </MemoryRouter>,
  );
};

const queueResponse = (ok: boolean, body: Record<string, unknown>): void => {
  (globalThis.fetch as Mock).mockResolvedValueOnce({
    ok,
    json: async () => body,
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

describe('SignupPage account creation', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends schema-required profile fields and navigates to sign in after creation', async () => {
    queueResponse(true, {
      code: 200,
      msg: 'Signup validation passed',
      data: { valid: true, fieldErrors: {} },
    });
    queueResponse(true, {
      code: 200,
      msg: 'Signup validation passed',
      data: { valid: true, fieldErrors: {} },
    });
    queueResponse(true, {
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
    queueResponse(true, {
      code: 200,
      msg: 'Google client config loaded',
      data: { clientId: 'mock-id' },
    });

    renderSignup();
    fillValidAccount();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Tell us about you' })).toBeInTheDocument();
    });

    await fillValidProfile();
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(4);
      expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent(
        'Account created successfully. You can now sign in.',
      );
    });

    const signupRequest = (globalThis.fetch as Mock).mock.calls[2]?.[1] as RequestInit;
    expect(signupRequest.body as string).toContain('emergencyContactNumber');
    expect(signupRequest.body as string).toContain('address');
    expect(signupRequest.body as string).toContain('"dateOfBirth":"1990-01-01"');
    expect(signupRequest.body as string).not.toContain('avatarId');
    expect(signupRequest.body as string).not.toContain('bio');
  });

  it('creates the account with only a name, leaving the optional details blank', async () => {
    const passed = {
      code: 200,
      msg: 'Signup validation passed',
      data: { valid: true, fieldErrors: {} },
    };
    queueResponse(true, passed);
    queueResponse(true, passed);
    queueResponse(true, {
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
    queueResponse(true, { code: 200, msg: 'Google client config loaded', data: { clientId: 'x' } });

    renderSignup();
    fillValidAccount();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('heading', { name: 'Tell us about you' });
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'David' } });
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Parent' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    await screen.findByRole('heading', { name: 'Sign in' });
    const signupRequest = (globalThis.fetch as Mock).mock.calls[2]?.[1] as RequestInit;
    expect(JSON.parse(signupRequest.body as string)).toMatchObject({
      firstName: 'David',
      lastName: 'Parent',
      emergencyContactNumber: '',
      address: '',
      dateOfBirth: '',
    });
  });

  it('shows a creation error when the signup API cannot be reached', async () => {
    queueResponse(true, {
      code: 200,
      msg: 'Signup validation passed',
      data: { valid: true, fieldErrors: {} },
    });
    queueResponse(true, {
      code: 200,
      msg: 'Signup validation passed',
      data: { valid: true, fieldErrors: {} },
    });
    (globalThis.fetch as Mock).mockRejectedValueOnce(new Error('Network unavailable'));

    renderSignup();
    fillValidAccount();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Tell us about you' })).toBeInTheDocument();
    });

    await fillValidProfile();
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => {
      expect(
        screen.getByText('Unable to create your account right now. Please try again.'),
      ).toBeInTheDocument();
    });
  });
});
