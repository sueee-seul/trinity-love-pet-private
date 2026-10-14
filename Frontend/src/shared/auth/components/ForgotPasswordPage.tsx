import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSiteCopy } from '../../i18n/siteLanguage';
import { authApi } from '../api/authApi';
import { AUTH_COPY, type AuthText } from '../authCopy';
import { AuthLayout } from './AuthLayout';
import { emailFromRouteState } from '../routeState';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const ForgotPasswordPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState(() => emailFromRouteState(location.state));
  // Kept as what happened, so the words follow a language switch.
  const [error, setError] = useState<{ text: AuthText } | null>(null);
  const copy = useSiteCopy(AUTH_COPY);
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const normalizedEmail = email.trim();
    if (!normalizedEmail || !EMAIL_PATTERN.test(normalizedEmail)) {
      setError({ text: (words) => words.forgot.invalidEmail });
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const result = await authApi.requestPasswordReset(normalizedEmail);
      if (!result.ok) {
        const message = result.data.msg;
        setError({ text: (words) => words.fromServer(message, words.forgot.resetUnavailable) });
        return;
      }

      setSubmitted(true);
      setResetUrl(result.data.data?.resetUrl ?? null);
    } catch {
      setError({ text: (words) => words.forgot.resetUnavailable });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title={copy.forgot.title}
      subtitle={copy.forgot.subtitle}
      footerLabel={copy.forgot.footer}
    >
      {submitted ? (
        <div className="space-y-5">
          <p role="status" className="type-body text-notice-secondary">
            {copy.forgot.sent}
          </p>

          {resetUrl && (
            <a
              href={resetUrl}
              className="block w-full rounded-full bg-action-dark theme-gradient-action px-6 py-3 text-center type-button text-on-action-dark transition-colors hover:bg-action-dark-hover"
            >
              {copy.forgot.continueReset}
            </a>
          )}

          <button
            type="button"
            onClick={() => navigate('/login')}
            className="w-full rounded-full border border-control-border px-6 py-3 type-button text-accent-foreground transition-colors hover:bg-surface-cream"
          >
            {copy.forgot.backToSignIn}
          </button>
        </div>
      ) : (
        // noValidate: the page checks the address itself; the browser would answer in its own language.
        <form onSubmit={(event) => void handleSubmit(event)} noValidate className="space-y-5">
          <label className="block">
            <span className="type-eyebrow text-notice-muted">{copy.forgot.email}</span>
            <input
              type="email"
              value={email}
              autoComplete="email"
              onChange={(event) => {
                setEmail(event.target.value);
                setError(null);
              }}
              className="mt-1.5 w-full rounded-xl border border-border-soft bg-surface-cream px-4 py-3 type-body focus:border-control-border focus:outline-none focus:ring-2 focus:ring-focus"
              aria-invalid={Boolean(error)}
            />
          </label>

          {error && (
            <p role="alert" className="type-body text-status-danger">
              {error.text(copy)}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full cursor-pointer rounded-full bg-action-dark theme-gradient-action px-6 py-3 type-button text-on-action-dark transition-colors hover:bg-action-dark-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? copy.forgot.sending : copy.forgot.sendLink}
          </button>

          <button
            type="button"
            onClick={() => navigate('/login')}
            className="w-full rounded-full border border-control-border px-6 py-3 type-button text-accent-foreground transition-colors hover:bg-surface-cream"
          >
            {copy.forgot.backToSignIn}
          </button>
        </form>
      )}
    </AuthLayout>
  );
};
