import { useState } from 'react';
import { isPetParentAccount } from '../../../shared/auth/accountIdentity';
import { authApi } from '../../../shared/auth/api/authApi';
import { AUTH_COPY } from '../../../shared/auth/authCopy';
import { useAuthStore } from '../../../shared/auth/store/authStore';
import { CONCIERGE_COPY } from '../copy';
import { useConciergeStore } from '../store/conciergeStore';

/** Loose on purpose: the server checks the address properly; this only catches a slip. */
const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NOT_FOUND = 404;

/**
 * What went wrong, kept as found rather than as words, so the message follows a language switch.
 * A refusal keeps the server's sentence: English shows it as sent, Chinese translates the known
 * ones (AUTH_COPY.fromServer), the same way the sign-in page does.
 */
type SignInProblem =
  | { kind: 'emailInvalid' }
  | { kind: 'passwordRequired' }
  | { kind: 'unknownEmail' }
  | { kind: 'staffAccount' }
  | { kind: 'connection' }
  | { kind: 'refused'; message: string | undefined };

export interface PasswordSignIn {
  email: string;
  setEmail: (email: string) => void;
  password: string;
  setPassword: (password: string) => void;
  busy: boolean;
  error: string | null;
  /** The address has no account: the form points at "Create an account". */
  unknownEmail: boolean;
  signIn: () => Promise<void>;
}

/**
 * Email and password, on the booking page itself. A pet parent account is signed in and the plan
 * moves on; a staff account is refused, because staff cannot book. The address is checked first
 * (`/auth/check-email`), because the sign-in endpoint answers "wrong password" for an unknown
 * address too, and a guest with no account should be sent to create one, not to retype a password.
 */
export const usePasswordSignIn = (onSignedIn?: () => void): PasswordSignIn => {
  const locale = useConciergeStore((state) => state.locale);
  const setVerified = useConciergeStore((state) => state.setVerified);
  const [email, setEmail] = useState(() => useConciergeStore.getState().verifiedEmail ?? '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<SignInProblem | null>(null);
  const words = CONCIERGE_COPY[locale].verify.errors;
  const error =
    problem === null
      ? null
      : problem.kind === 'refused'
        ? AUTH_COPY[locale].fromServer(problem.message, words.wrongPassword)
        : words[problem.kind];

  const signIn = async (): Promise<void> => {
    const address = email.trim();
    if (!LOOKS_LIKE_EMAIL.test(address)) {
      setProblem({ kind: 'emailInvalid' });
      return;
    }
    if (password.length === 0) {
      setProblem({ kind: 'passwordRequired' });
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      const known = await authApi.checkEmail(address);
      if (!known.ok) {
        setProblem(
          known.status === NOT_FOUND
            ? { kind: 'unknownEmail' }
            : { kind: 'refused', message: known.data.msg },
        );
        return;
      }
      const result = await authApi.loginWithPassword(address, password);
      const user = result.data.data?.user;
      if (!result.ok || !user) {
        setProblem({ kind: 'refused', message: result.data.msg });
        return;
      }
      if (!isPetParentAccount(user)) {
        // The server has already set a session cookie for the staff member. The booking page is
        // no place for a staff session, so it is ended again before saying why.
        await authApi.logout().catch(() => undefined);
        setProblem({ kind: 'staffAccount' });
        return;
      }
      useAuthStore.getState().login(user);
      // The address the request is for; with no email-code token, the session is the proof.
      setVerified(user.email, null);
      setPassword('');
      onSignedIn?.();
    } catch {
      // fetch rejects when the server cannot be reached; an unreadable answer ends up here too.
      setProblem({ kind: 'connection' });
    } finally {
      setBusy(false);
    }
  };

  return {
    email,
    setEmail,
    password,
    setPassword,
    busy,
    error,
    unknownEmail: problem?.kind === 'unknownEmail',
    signIn,
  };
};
