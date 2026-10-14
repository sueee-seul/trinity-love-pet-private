import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authApi } from '../../../shared/auth/api/authApi';
import { useAuthStore } from '../../../shared/auth/store/authStore';
import { englishWordsIn } from '../../../shared/i18n/testing/englishWordsIn';
import { PasswordSignInForm } from '../components/checkout/PasswordSignInForm';
import { CONCIERGE_COPY } from '../copy';
import { useConciergeStore } from '../store/conciergeStore';
import type { ConciergeLocale } from '../types';
import { AVA } from './fixtures';

vi.mock('../../../shared/auth/api/authApi', () => ({
  authApi: { checkEmail: vi.fn(), loginWithPassword: vi.fn(), logout: vi.fn() },
}));

const knownEmail = (): void => {
  vi.mocked(authApi.checkEmail).mockResolvedValue({ ok: true, status: 200, data: {} });
};

const renderForm = (
  locale: ConciergeLocale = 'en',
  onSignedIn = vi.fn(),
): ReturnType<typeof userEvent.setup> => {
  useConciergeStore.getState().setLocale(locale);
  const user = userEvent.setup();
  // The form links to the sign-up and recovery pages, so it renders inside a router as in the app.
  render(
    <MemoryRouter initialEntries={['/book?step=verify']}>
      <PasswordSignInForm copy={CONCIERGE_COPY[locale]} onSignedIn={onSignedIn} />
    </MemoryRouter>,
  );
  return user;
};

const fillAndSubmit = async (
  user: ReturnType<typeof userEvent.setup>,
  labels: { email: string; password: string; button: string },
  password = 'Password#1',
): Promise<void> => {
  await user.type(screen.getByLabelText(labels.email), AVA.email);
  await user.type(screen.getByLabelText(labels.password), password);
  await act(async () => {
    await user.click(screen.getByRole('button', { name: labels.button }));
  });
};

const EN_LABELS = { email: 'Email address', password: 'Password', button: 'Sign in' };
const ZH_LABELS = { email: '邮箱', password: '密码', button: '登录' };

describe('PasswordSignInForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ user: null, isAuthenticated: false, isHydrating: false });
    useConciergeStore.getState().reset();
    useConciergeStore.setState({ step: 'verify' });
  });

  afterEach(() => {
    useConciergeStore.getState().setLocale('en');
  });

  it('signs a pet parent in and moves the plan on to the details', async () => {
    knownEmail();
    vi.mocked(authApi.loginWithPassword).mockResolvedValue({
      ok: true,
      status: 200,
      data: { data: { user: { id: 'owner-1', ...AVA } } },
    });
    const onSignedIn = vi.fn();
    const user = renderForm('en', onSignedIn);

    await fillAndSubmit(user, EN_LABELS);

    expect(authApi.loginWithPassword).toHaveBeenCalledWith(AVA.email, 'Password#1');
    expect(useAuthStore.getState().user?.email).toBe(AVA.email);
    expect(useConciergeStore.getState().verifiedEmail).toBe(AVA.email);
    expect(useConciergeStore.getState().verificationToken).toBeNull();
    expect(useConciergeStore.getState().step).toBe('details');
    expect(onSignedIn).toHaveBeenCalledTimes(1);
  });

  it('shows the server’s words for a wrong password', async () => {
    knownEmail();
    vi.mocked(authApi.loginWithPassword).mockResolvedValue({
      ok: false,
      status: 401,
      data: { msg: 'Wrong password. Try again.', data: null },
    });
    const user = renderForm();

    await fillAndSubmit(user, EN_LABELS, 'nope');

    expect(screen.getByRole('alert')).toHaveTextContent('Wrong password. Try again.');
    expect(useAuthStore.getState().user).toBeNull();
    expect(useConciergeStore.getState().step).toBe('verify');
  });

  it('offers to create an account when the address has none, and never asks for a password check', async () => {
    vi.mocked(authApi.checkEmail).mockResolvedValue({
      ok: false,
      status: 404,
      data: { msg: 'Email not registered.', data: null },
    });
    const user = renderForm();

    await fillAndSubmit(user, EN_LABELS);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'No account with this email yet. Create one below.',
    );
    expect(authApi.loginWithPassword).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute(
      'href',
      '/signup',
    );
    expect(screen.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });

  it('refuses a staff account and ends the session the server opened for it', async () => {
    knownEmail();
    vi.mocked(authApi.loginWithPassword).mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        data: {
          user: {
            id: 'employee-1',
            email: AVA.email,
            is_employee: true,
            is_pet_owner: false,
            employee_role: 'staff',
          },
        },
      },
    });
    vi.mocked(authApi.logout).mockResolvedValue({ ok: true, status: 200, data: {} });
    const user = renderForm();

    await fillAndSubmit(user, EN_LABELS);

    expect(screen.getByRole('alert')).toHaveTextContent(/staff account/);
    expect(authApi.logout).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().user).toBeNull();
    expect(useConciergeStore.getState().step).toBe('verify');
  });

  // The browser would word its own warning in the browser's language, not the page's.
  it('checks the fields itself and says everything in Chinese', async () => {
    knownEmail();
    vi.mocked(authApi.loginWithPassword).mockResolvedValue({
      ok: false,
      status: 401,
      data: { msg: 'Wrong password. Try again.', data: null },
    });
    const user = renderForm('zh');

    await user.type(screen.getByLabelText('邮箱'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: '登录' }));
    expect(screen.getByText('请输入有效的邮箱地址。')).toBeInTheDocument();
    expect(authApi.checkEmail).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText('邮箱'));
    await fillAndSubmit(user, ZH_LABELS, 'nope');

    expect(screen.getByRole('alert')).toHaveTextContent('密码不对，请再试一次。');
    expect(screen.getByRole('link', { name: '创建账号' })).toBeInTheDocument();
    expect(englishWordsIn(document.body)).toEqual([]);
  });
});
