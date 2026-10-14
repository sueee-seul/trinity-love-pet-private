import React from 'react';
import { GoogleLogin, GoogleOAuthProvider, type CredentialResponse } from '@react-oauth/google';
import { useSiteCopy } from '../../i18n/siteLanguage';
import { AUTH_COPY } from '../authCopy';
import { AuthFieldError } from './AuthFieldError';

interface LoginEmailStepProps {
  email: string;
  error: string;
  clientId: string | null;
  /** The Backend has no real Google client ID, so show why the button is off. */
  googleUnavailable?: boolean;
  onEmailChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void | Promise<void>;
  onGoogleSuccess: (response: CredentialResponse) => void | Promise<void>;
  onGoogleError: () => void;
}

export const LoginEmailStep: React.FC<LoginEmailStepProps> = ({
  email,
  error,
  clientId,
  googleUnavailable = false,
  onEmailChange,
  onSubmit,
  onGoogleSuccess,
  onGoogleError,
}) => {
  const copy = useSiteCopy(AUTH_COPY).login;

  return (
    // noValidate: the page checks the address itself; the browser would answer in its own language.
    <form onSubmit={onSubmit} noValidate className="flex flex-col">
      <div className="relative mb-2">
        <input
          type="email"
          id="email"
          value={email}
          onChange={(event) => onEmailChange(event.target.value)}
          className={`peer type-body h-[56px] w-full rounded border bg-transparent px-4 pb-1 pt-5 transition-colors focus:outline-none ${error ? 'border-status-danger focus:border-2 focus:border-status-danger' : 'border-control-border focus:border-2 focus:border-focus'}`}
          placeholder=" "
          autoFocus
        />
        <label
          htmlFor="email"
          className={`absolute left-4 top-4 bg-surface-card px-1 type-body text-notice-muted transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-body peer-focus:top-[-10px] peer-focus:font-bold peer-focus:text-meta peer-focus:text-accent-foreground ${email ? 'top-[-10px] font-bold text-meta' : ''} ${error ? 'text-status-danger peer-focus:text-status-danger' : ''}`}
        >
          {copy.email}
        </label>
      </div>
      {error && <AuthFieldError message={error} />}

      <div className="mt-10 flex flex-col space-y-5">
        <div className="relative flex items-center justify-center">
          <div className="w-full border-t border-border-soft" />
          <div className="absolute bg-surface-card px-4 type-eyebrow text-notice-muted">
            {copy.or}
          </div>
        </div>
        <div className="flex min-h-[44px] w-full justify-center">
          {clientId ? (
            // Google draws its button in the browser's language unless told otherwise, so a
            // Chinese browser showed Chinese text on the English sign-in page. The button is
            // redrawn when the locale changes.
            <GoogleOAuthProvider clientId={clientId} locale={copy.googleLocale}>
              <GoogleLogin
                onSuccess={onGoogleSuccess}
                onError={onGoogleError}
                shape="pill"
                size="large"
                // Google draws the button at this exact width. 280 fits the sign-in card's form
                // column on a 360px phone (288px); 300 ran past the card.
                width="280"
                text="signin_with"
              />
            </GoogleOAuthProvider>
          ) : (
            <div className="flex w-full cursor-not-allowed items-center justify-center space-x-3 rounded-full border border-control-border bg-surface-cream py-2.5 type-body text-notice-muted">
              <svg className="h-5 w-5 opacity-50" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
                <path d="M1 1h22v22H1z" fill="none" />
              </svg>
              <span>{googleUnavailable ? copy.googleNotSetUp : copy.loadingGoogle}</span>
            </div>
          )}
        </div>
      </div>
    </form>
  );
};
