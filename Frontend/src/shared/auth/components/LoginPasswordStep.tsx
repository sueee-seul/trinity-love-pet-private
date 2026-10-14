import React from 'react';
import { useSiteCopy } from '../../i18n/siteLanguage';
import { AUTH_COPY } from '../authCopy';
import { AuthFieldError } from './AuthFieldError';

interface LoginPasswordStepProps {
  password: string;
  error: string;
  showPassword: boolean;
  onPasswordChange: (value: string) => void;
  onTogglePassword: () => void;
  onForgotPassword: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void | Promise<void>;
}

export const LoginPasswordStep: React.FC<LoginPasswordStepProps> = ({
  password,
  error,
  showPassword,
  onPasswordChange,
  onTogglePassword,
  onForgotPassword,
  onSubmit,
}) => {
  const copy = useSiteCopy(AUTH_COPY).login;

  return (
    <form onSubmit={onSubmit} className="flex flex-col">
      <div className="relative mb-2 flex items-center">
        <input
          type={showPassword ? 'text' : 'password'}
          id="password"
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
          className={`peer type-body h-[56px] w-full rounded border bg-transparent px-4 pb-1 pt-5 pr-12 transition-colors focus:outline-none ${error ? 'border-status-danger focus:border-2 focus:border-status-danger' : 'border-control-border focus:border-2 focus:border-focus'}`}
          placeholder=" "
          autoFocus
        />
        <label
          htmlFor="password"
          className={`absolute left-4 top-4 bg-surface-card px-1 type-body text-notice-muted transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-body peer-focus:top-[-10px] peer-focus:font-bold peer-focus:text-meta peer-focus:text-accent-foreground ${password ? 'top-[-10px] font-bold text-meta' : ''} ${error ? 'text-status-danger peer-focus:text-status-danger' : ''}`}
        >
          {copy.password}
        </label>
        <button
          type="button"
          onClick={onTogglePassword}
          className="absolute right-3 rounded-full p-1.5 text-notice-muted transition-colors hover:bg-surface-deep hover:text-notice-primary focus:outline-none"
          aria-label={showPassword ? copy.hidePassword : copy.showPassword}
        >
          {showPassword ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
              <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
              <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
              <line x1="2" y1="2" x2="22" y2="22" />
            </svg>
          )}
        </button>
      </div>
      {error && <AuthFieldError message={error} />}

      <div className="mt-3">
        <button
          type="button"
          onClick={onForgotPassword}
          className="type-button text-accent-foreground hover:text-accent-foreground-hover hover:underline"
        >
          {copy.forgotPassword}
        </button>
      </div>
    </form>
  );
};
