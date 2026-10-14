import React, { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useSiteCopy } from '../../i18n/siteLanguage';
import { authApi, type TemporaryPasswordChangeData } from '../api/authApi';
import { AUTH_COPY, type AuthCopy, type AuthText } from '../authCopy';
import { meetsPasswordRules } from '../passwordRules';
import { useAuthStore } from '../store/authStore';
import { AuthLayout } from './AuthLayout';
import { PasswordRequirements } from './PasswordRequirements';

const REQUIREMENTS_ID = 'password-requirements';

/** The Backend's own reasons for rejecting a password, in the order it gave them. */
const fieldErrorText = (
  data: TemporaryPasswordChangeData | null | undefined,
  copy: AuthCopy,
): string | null => {
  const errors = [
    ...(data?.fieldErrors?.password ?? []).map((error) => copy.fieldError('password', error)),
    ...(data?.fieldErrors?.confirmPassword ?? []).map((error) =>
      copy.fieldError('confirmPassword', error),
    ),
  ];
  return errors.length > 0 ? errors.join(' ') : null;
};

const fieldClass =
  'w-full rounded-xl border border-border-soft bg-surface-cream px-4 py-3 type-body ' +
  'focus:border-control-border focus:outline-none focus:ring-2 focus:ring-focus';

type PasswordUpdateMode = 'temporary' | 'reset';

interface PasswordUpdatePageProps {
  mode: PasswordUpdateMode;
}

const PASSWORD_RESET_SUCCESS_NOTICE = {
  notice: { type: 'success' as const, kind: 'passwordReset' as const },
};

export const PasswordUpdatePage: React.FC<PasswordUpdatePageProps> = ({ mode }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isHydrating = useAuthStore((state) => state.isHydrating);
  const login = useAuthStore((state) => state.login);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  // Kept as what happened, so the words follow a language switch.
  const [error, setError] = useState<{ text: AuthText } | null>(null);
  const copy = useSiteCopy(AUTH_COPY);
  const [saving, setSaving] = useState(false);
  const isResetMode = mode === 'reset';
  const resetToken = searchParams.get('token') ?? '';

  if (!isResetMode && isHydrating) {
    return null;
  }

  if (!isResetMode && (!isAuthenticated || !user || !user.is_employee)) {
    return <Navigate to="/login" replace />;
  }

  if (!isResetMode && user?.isUsingTemporaryPassword !== true) {
    return <Navigate to="/admin" replace />;
  }

  if (isResetMode && !resetToken) {
    return (
      <AuthLayout
        title={copy.setPassword.title}
        subtitle={copy.setPassword.invalidLink}
        footerLabel={copy.setPassword.footerReset}
      >
        <div className="space-y-5">
          <p role="alert" className="type-body text-status-danger">
            {copy.setPassword.requestNew}
          </p>
          <button
            type="button"
            onClick={() => navigate('/login', { replace: true })}
            className="w-full rounded-full bg-action-dark theme-gradient-action px-6 py-3 type-button text-on-action-dark transition-colors hover:bg-action-dark-hover"
          >
            {copy.setPassword.backToSignIn}
          </button>
        </div>
      </AuthLayout>
    );
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!meetsPasswordRules(password)) {
      setError({ text: (words) => words.setPassword.notAllRules });
      return;
    }
    if (password !== confirmPassword) {
      setError({ text: (words) => words.setPassword.mismatch });
      return;
    }
    setError(null);
    setSaving(true);

    try {
      const result = isResetMode
        ? await authApi.completePasswordReset(resetToken, password, confirmPassword)
        : await authApi.completeTemporaryPassword(password, confirmPassword);

      if (result.ok && result.data.data?.passwordChanged === true) {
        if (isResetMode) {
          navigate('/login', { replace: true, state: PASSWORD_RESET_SUCCESS_NOTICE });
          return;
        }

        if (user) {
          login({ ...user, isUsingTemporaryPassword: false });
        }
        navigate('/admin', { replace: true });
        return;
      }

      const refused = result.data;
      setError({
        text: (words) =>
          fieldErrorText(refused.data, words) ??
          words.fromServer(refused.msg, words.setPassword.updateFailed),
      });
    } catch {
      setError({ text: (words) => words.setPassword.unreachable });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthLayout
      title={copy.setPassword.title}
      subtitle={isResetMode ? copy.setPassword.subtitleReset : copy.setPassword.subtitleTemporary}
      footerLabel={isResetMode ? copy.setPassword.footerReset : copy.setPassword.footerTemporary}
    >
      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5">
        <label className="block">
          <span className="type-eyebrow text-notice-muted">{copy.setPassword.newPassword}</span>
          <input
            type="password"
            value={password}
            autoComplete="new-password"
            onChange={(event) => setPassword(event.target.value)}
            className={`mt-1.5 ${fieldClass}`}
            aria-invalid={Boolean(error)}
            aria-describedby={REQUIREMENTS_ID}
          />
        </label>

        <label className="block">
          <span className="type-eyebrow text-notice-muted">{copy.setPassword.confirmNew}</span>
          <input
            type="password"
            value={confirmPassword}
            autoComplete="new-password"
            onChange={(event) => setConfirmPassword(event.target.value)}
            className={`mt-1.5 ${fieldClass}`}
            aria-invalid={Boolean(error)}
            aria-describedby={REQUIREMENTS_ID}
          />
        </label>

        <PasswordRequirements
          id={REQUIREMENTS_ID}
          password={password}
          confirmPassword={confirmPassword}
        />

        {error && (
          <p role="alert" className="type-body text-status-danger">
            {error.text(copy)}
          </p>
        )}

        <button
          type="submit"
          disabled={saving || password.length === 0 || confirmPassword.length === 0}
          className="w-full cursor-pointer rounded-full bg-action-dark theme-gradient-action px-6 py-3 type-button text-on-action-dark transition-colors hover:bg-action-dark-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving
            ? copy.setPassword.saving
            : isResetMode
              ? copy.setPassword.resetPassword
              : copy.setPassword.setAndContinue}
        </button>
      </form>
    </AuthLayout>
  );
};

export const FirstLoginPasswordPage: React.FC = () => {
  return <PasswordUpdatePage mode="temporary" />;
};

export const ResetPasswordPage: React.FC = () => {
  return <PasswordUpdatePage mode="reset" />;
};
