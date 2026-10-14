import React, { useEffect, useRef, useState } from 'react';
import type { ConciergeCopy } from '../../copy';
import { ConciergeDialog } from '../ConciergeDialog';
import { PRIMARY_BUTTON } from '../conciergeStyles';
import { PasswordSignInForm } from './PasswordSignInForm';

interface SignInDialogProps {
  copy: ConciergeCopy;
  open: boolean;
  onClose: () => void;
}

/**
 * "Booked with us before? Sign in" without leaving the plan: the same email and password form as
 * the sign-in step, in a dialog over the page. Once signed in, the saved pets are offered and the
 * sign-in step after continuing with a stay is skipped.
 */
export const SignInDialog: React.FC<SignInDialogProps> = ({ copy, open, onClose }) => {
  const [signedIn, setSignedIn] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const close = (): void => {
    setSignedIn(false);
    onClose();
  };

  // The form (and its focused Sign in button) is replaced by the result: the keyboard moves on.
  useEffect(() => {
    if (signedIn) closeRef.current?.focus();
  }, [signedIn]);

  return (
    <ConciergeDialog
      open={open}
      title={copy.verify.signInTitle}
      closeLabel={copy.verify.close}
      onClose={close}
    >
      {/* Mounted from the start so the result is announced when its text arrives. */}
      <p role="status" className={signedIn ? 'm-0 type-body' : 'sr-only'}>
        {signedIn ? copy.verify.signedIn : ''}
      </p>
      {signedIn ? (
        <button
          ref={closeRef}
          type="button"
          onClick={close}
          className={`${PRIMARY_BUTTON} self-start`}
        >
          {copy.verify.close}
        </button>
      ) : (
        <>
          <p className="m-0 type-body text-notice-secondary">{copy.verify.signInLead}</p>
          <PasswordSignInForm copy={copy} onSignedIn={() => setSignedIn(true)} />
        </>
      )}
    </ConciergeDialog>
  );
};
