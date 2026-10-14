import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { CredentialResponse } from '@react-oauth/google';
import { useSiteCopy } from '../../i18n/siteLanguage';
import { AUTH_COPY, type AuthNoticeKind, type AuthText } from '../authCopy';
import { AuthLayout } from './AuthLayout';
import { LoginEmailStep } from './LoginEmailStep';
import { LoginPasswordStep } from './LoginPasswordStep';
import { useAuthLogin } from '../hooks/useAuthLogin';
import { useAuthStore, type User } from '../store/authStore';
import { emailFromRouteState, returnToFromRouteState } from '../routeState';

type LoginStep = 'EMAIL' | 'PASSWORD';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const NOTICE_KINDS: readonly AuthNoticeKind[] = ['accountCreated', 'passwordReset'];

/** The page that sent the visitor here names what happened; this page words it. */
const getSuccessNotice = (state: unknown): AuthNoticeKind | null => {
  if (typeof state !== 'object' || state === null || !('notice' in state)) {
    return null;
  }

  const notice = state.notice;
  if (
    typeof notice !== 'object' ||
    notice === null ||
    !('type' in notice) ||
    !('kind' in notice) ||
    notice.type !== 'success'
  ) {
    return null;
  }

  return NOTICE_KINDS.find((kind) => kind === notice.kind) ?? null;
};

const navigateByAccountIdentity = (
  user: User,
  navigate: (path: string) => void,
  returnTo: string | null = null,
): void => {
  if (user.is_employee) {
    if (user.isUsingTemporaryPassword === true) {
      navigate('/first-login-password');
      return;
    }
    navigate('/admin');
    return;
  }

  if (user.is_pet_owner) {
    // A page that sent the parent here to sign in (the booking page, when the email already has
    // a password) gets them back with their plan; everyone else lands on the portal home.
    navigate(returnTo ?? '/parent');
    return;
  }

  throw new Error('Account has no enabled website identity');
};
export function LoginPage(): React.ReactElement {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const copy = useSiteCopy(AUTH_COPY);
  const initialError: { text: AuthText } | null = searchParams.get('error')
    ? { text: (words) => words.login.googleAuthFailed }
    : null;
  const successNotice = getSuccessNotice(location.state);
  const [step, setStep] = useState<LoginStep>('EMAIL');
  const [email, setEmail] = useState(() => emailFromRouteState(location.state));
  const returnTo = returnToFromRouteState(location.state);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  // Kept as what happened, so the words follow a language switch.
  const [error, setError] = useState<{ text: AuthText } | null>(initialError);
  const errorText = error ? error.text(copy) : '';
  const navigate = useNavigate();
  const { clientId, googleUnavailable, checkEmail, loginWithPassword, loginWithGoogle } =
    useAuthLogin();
  const login = useAuthStore((state) => state.login);

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse): Promise<void> => {
    try {
      const result = await loginWithGoogle(credentialResponse);
      if (result.success && result.data?.data?.user) {
        const user = result.data.data.user as User;
        login(user);
        navigateByAccountIdentity(user, navigate, returnTo);
      } else if (!result.success && result.data?.action === 'REQUIRE_SIGNUP') {
        navigate('/signup', {
          state: {
            googleUser: result.data.data,
            idToken: credentialResponse.credential,
          },
        });
      } else {
        const message = result.data?.msg;
        setError({ text: (words) => words.fromServer(message, words.login.googleFailed) });
      }
    } catch {
      setError({ text: (words) => words.login.loginFailed });
    }
  };

  const handleNextEmail = async (event?: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event?.preventDefault();
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setError({ text: (words) => words.login.enterEmail });
      return;
    }

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setError({ text: (words) => words.login.invalidEmail });
      return;
    }

    try {
      const result = await checkEmail(normalizedEmail);
      if (result.success) {
        setStep('PASSWORD');
        setError(null);
      } else {
        const message = result.msg;
        setError({ text: (words) => words.fromServer(message, words.login.accountNotFound) });
      }
    } catch {
      setError({ text: (words) => words.login.connectionFailed });
    }
  };

  const handleNextPassword = async (event?: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event?.preventDefault();

    try {
      const result = await loginWithPassword(email.trim(), password);
      if (result.success && result.data?.data?.user) {
        const user = result.data.data.user as User;
        login(user);
        navigateByAccountIdentity(user, navigate, returnTo);
      } else {
        const message = result.data?.msg;
        setError({ text: (words) => words.fromServer(message, words.login.wrongPassword) });
      }
    } catch {
      setError({ text: (words) => words.login.loginFailed });
    }
  };

  const resetToEmailStep = (): void => {
    setStep('EMAIL');
    setPassword('');
    setError(null);
  };

  const handleForgotPassword = (): void => {
    navigate('/forgot-password', { state: { email: email.trim() } });
  };

  const subtitle =
    step === 'EMAIL' ? (
      copy.login.useAccount
    ) : (
      <button
        type="button"
        onClick={resetToEmailStep}
        className="type-button flex items-center space-x-2 rounded-full border border-control-border px-3 py-1.5 transition-colors hover:bg-surface-cream focus:outline-none focus:ring-2 focus:ring-focus/20"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4 text-notice-secondary"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
        <span className="type-body">{email}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-3 w-3 text-notice-muted"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    );

  return (
    <AuthLayout
      title={step === 'EMAIL' ? copy.login.signIn : copy.login.welcome}
      subtitle={subtitle}
      // Visitors often arrive from a shared link, so the card offers a way back to the front page.
      backLink={{ to: '/', label: copy.login.backHome }}
    >
      {successNotice && (
        <div
          role="status"
          className="mb-5 rounded-xl bg-surface-deep px-4 py-3 type-body text-accent-foreground"
        >
          {copy.notices[successNotice]}
        </div>
      )}
      {step === 'EMAIL' ? (
        <LoginEmailStep
          email={email}
          error={errorText}
          clientId={clientId}
          googleUnavailable={googleUnavailable}
          onEmailChange={(value) => {
            setEmail(value);
            if (error) setError(null);
          }}
          onSubmit={(event) => handleNextEmail(event)}
          onGoogleSuccess={handleGoogleSuccess}
          onGoogleError={() => setError({ text: (words) => words.login.googleFailed })}
        />
      ) : (
        <LoginPasswordStep
          password={password}
          error={errorText}
          showPassword={showPassword}
          onPasswordChange={(value) => {
            setPassword(value);
            if (error) setError(null);
          }}
          onTogglePassword={() => setShowPassword((visible) => !visible)}
          onForgotPassword={handleForgotPassword}
          onSubmit={(event) => handleNextPassword(event)}
        />
      )}

      <p className="mt-8 mb-0 type-meta">
        {copy.login.bookPrompt}{' '}
        <Link
          to="/book"
          className="font-semibold text-accent-foreground underline-offset-4 hover:underline"
        >
          {copy.login.bookLink}
        </Link>
      </p>

      <div className="mt-10 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/signup')}
          className="-ml-4 rounded-full px-4 py-2 type-button text-accent-foreground transition-colors hover:bg-surface-cream hover:text-accent-foreground-hover"
        >
          {copy.login.createAccount}
        </button>
        <button
          type="button"
          onClick={() => {
            if (step === 'EMAIL') {
              void handleNextEmail();
            } else {
              void handleNextPassword();
            }
          }}
          className="rounded-full bg-action-dark theme-gradient-action px-6 py-2 type-button text-on-action-dark transition-colors hover:bg-action-dark-hover focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2"
        >
          {copy.login.next}
        </button>
      </div>
    </AuthLayout>
  );
}
