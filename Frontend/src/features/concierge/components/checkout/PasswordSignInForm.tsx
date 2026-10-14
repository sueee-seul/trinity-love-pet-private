import React, { useId } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { ConciergeCopy } from '../../copy';
import { usePasswordSignIn } from '../../hooks/usePasswordSignIn';
import { ERROR_TEXT, FIELD, FIELD_LABEL, PRIMARY_BUTTON, TEXT_BUTTON } from '../conciergeStyles';

interface PasswordSignInFormProps {
  copy: ConciergeCopy;
  onSignedIn?: () => void;
  /** A secondary action beside the Sign in button, e.g. Back. */
  secondary?: React.ReactNode;
}

/**
 * Email and password, with the way to a forgotten password and to a new account. Shared by the
 * sign-in step after "Continue with this stay" and the "Booked with us before? Sign in" dialog,
 * so both behave and read the same. The plan stays in this tab whichever way the guest goes.
 */
export const PasswordSignInForm: React.FC<PasswordSignInFormProps> = ({
  copy,
  onSignedIn,
  secondary,
}) => {
  const signIn = usePasswordSignIn(onSignedIn);
  const location = useLocation();
  const emailId = useId();
  const passwordId = useId();
  const errorId = useId();
  const { verify } = copy;
  const invalid = signIn.error ? true : undefined;
  // The sign-up page brings the parent back here, with the plan still waiting in the tab.
  const returnTo = `${location.pathname}${location.search}`;

  return (
    // noValidate: the browser would word its warnings in its own language, not the page's.
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void signIn.signIn();
      }}
    >
      <div>
        <label htmlFor={emailId} className={FIELD_LABEL}>
          {verify.emailLabel}
        </label>
        <input
          id={emailId}
          type="email"
          autoComplete="email"
          spellCheck={false}
          inputMode="email"
          required
          value={signIn.email}
          onChange={(event) => signIn.setEmail(event.target.value)}
          aria-invalid={invalid}
          aria-errormessage={invalid ? errorId : undefined}
          className={FIELD}
        />
      </div>
      <div>
        <label htmlFor={passwordId} className={FIELD_LABEL}>
          {verify.passwordLabel}
        </label>
        <input
          id={passwordId}
          type="password"
          autoComplete="current-password"
          required
          value={signIn.password}
          onChange={(event) => signIn.setPassword(event.target.value)}
          aria-invalid={invalid}
          aria-errormessage={invalid ? errorId : undefined}
          className={FIELD}
        />
      </div>
      {signIn.error && (
        <p id={errorId} role="alert" className={ERROR_TEXT}>
          {signIn.error}
        </p>
      )}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        {secondary ?? <span />}
        <button type="submit" disabled={signIn.busy} className={PRIMARY_BUTTON}>
          {signIn.busy ? verify.signingIn : verify.signIn}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <Link
          to="/forgot-password"
          state={{ email: signIn.email.trim() }}
          className={`${TEXT_BUTTON} px-0`}
        >
          {verify.forgotPassword}
        </Link>
        <Link
          to="/signup"
          state={{ email: signIn.email.trim(), returnTo }}
          // An address with no account: creating one is the way on, so the link is the main one.
          className={
            signIn.unknownEmail ? `${PRIMARY_BUTTON} min-h-11 px-5` : `${TEXT_BUTTON} px-0`
          }
        >
          {verify.createAccount}
        </Link>
      </div>
    </form>
  );
};
