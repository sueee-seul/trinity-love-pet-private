import { API_BASE_URL } from '../../api';
import type { CredentialResponse } from '@react-oauth/google';
import type {
  SignupErrors,
  SignupValidationData,
  SignupValidationRequest,
} from '../components/signupTypes';

interface AuthEnvelope<T> {
  msg?: string;
  action?: string;
  data?: T | null;
}

export interface AuthApiResult<T> {
  ok: boolean;
  /**
   * The HTTP status, so a caller can tell "no such account" (404) from a refusal or a fault. The
   * client always sets it; it is optional only because call sites and mocks older than it do not.
   */
  status?: number;
  data: AuthEnvelope<T>;
}

interface GoogleConfig {
  clientId?: string;
}

interface AuthSession {
  user?: {
    id?: string;
    email: string;
    name?: string;
    is_employee: boolean;
    is_pet_owner: boolean;
    employee_role?: 'manager' | 'staff' | null;
    avatarUrl?: string;
    isUsingTemporaryPassword?: boolean;
  };
  email?: string;
  firstName?: string;
  lastName?: string;
}

interface LogoutData {
  loggedOut?: boolean;
}

interface PasswordFieldError {
  code: string;
  message: string;
}

/**
 * A successful change answers `{ passwordChanged }`. A password the rules reject answers 400 with
 * `{ fieldErrors }`, which says exactly which rule failed, so both shapes are accepted.
 */
export interface TemporaryPasswordChangeData {
  passwordChanged?: boolean;
  fieldErrors?: Partial<Record<'password' | 'confirmPassword', PasswordFieldError[]>>;
}

interface PasswordResetRequestData {
  resetUrl?: string;
  /** 'email': a reset link is on its way; 'none': this server cannot send one. */
  delivery?: 'email' | 'none';
}

interface SignupCreationData {
  user?: {
    email: string;
    name?: string;
    is_employee?: boolean;
    is_pet_owner?: boolean;
    employee_role?: 'manager' | 'staff' | null;
  };
  fieldErrors?: SignupErrors;
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const isGoogleConfig = (value: unknown): value is GoogleConfig => {
  return isRecord(value) && (value.clientId === undefined || typeof value.clientId === 'string');
};

const isEmailData = (value: unknown): value is { email?: string } => {
  return isRecord(value) && (value.email === undefined || typeof value.email === 'string');
};

const isAuthSession = (value: unknown): value is AuthSession => {
  return isRecord(value); // Loosen for Google login returning require_signup data
};

const isLogoutData = (value: unknown): value is LogoutData => {
  return isRecord(value) && (value.loggedOut === undefined || typeof value.loggedOut === 'boolean');
};

const isTemporaryPasswordChangeData = (value: unknown): value is TemporaryPasswordChangeData => {
  return (
    isRecord(value) && (typeof value.passwordChanged === 'boolean' || isRecord(value.fieldErrors))
  );
};

const isPasswordResetRequestData = (value: unknown): value is PasswordResetRequestData => {
  return (
    isRecord(value) &&
    (value.resetUrl === undefined || typeof value.resetUrl === 'string') &&
    (value.delivery === undefined || value.delivery === 'email' || value.delivery === 'none')
  );
};

const isSignupFieldErrors = (value: unknown): value is SignupErrors => {
  if (!isRecord(value)) {
    return false;
  }

  return Object.values(value).every((fieldErrors) => {
    return (
      Array.isArray(fieldErrors) &&
      fieldErrors.every(
        (fieldError) =>
          isRecord(fieldError) &&
          typeof fieldError.code === 'string' &&
          typeof fieldError.message === 'string',
      )
    );
  });
};

const isSignupValidationData = (value: unknown): value is SignupValidationData => {
  return (
    isRecord(value) && typeof value.valid === 'boolean' && isSignupFieldErrors(value.fieldErrors)
  );
};

const isSignupCreationData = (value: unknown): value is SignupCreationData => {
  if (!isRecord(value)) {
    return false;
  }

  const user = value.user;
  const userIsValid =
    user === undefined ||
    (isRecord(user) &&
      typeof user.email === 'string' &&
      (user.name === undefined || typeof user.name === 'string') &&
      (user.is_employee === undefined || typeof user.is_employee === 'boolean') &&
      (user.is_pet_owner === undefined || typeof user.is_pet_owner === 'boolean') &&
      (user.employee_role === undefined ||
        user.employee_role === null ||
        user.employee_role === 'manager' ||
        user.employee_role === 'staff'));
  const fieldErrors = value.fieldErrors;

  return userIsValid && (fieldErrors === undefined || isSignupFieldErrors(fieldErrors));
};

const parseEnvelope = <T>(
  value: unknown,
  isData: (data: unknown) => data is T,
): AuthEnvelope<T> => {
  if (!isRecord(value)) {
    throw new Error('Invalid authentication response');
  }

  const envelope: AuthEnvelope<T> = {};
  if (typeof value.msg === 'string') {
    envelope.msg = value.msg;
  }
  if (typeof value.action === 'string') {
    envelope.action = value.action;
  }
  if (value.data === null) {
    envelope.data = null;
  } else if (value.data !== undefined) {
    if (!isData(value.data)) {
      throw new Error('Invalid authentication response data');
    }
    envelope.data = value.data;
  }
  return envelope;
};

export const authApi = {
  getGoogleConfig: async (): Promise<AuthEnvelope<GoogleConfig>> => {
    const res = await fetch(`${API_BASE_URL}/auth/google/config`);
    if (!res.ok) throw new Error('Failed to load Google client config');
    return parseEnvelope(await res.json(), isGoogleConfig);
  },

  checkEmail: async (email: string): Promise<AuthApiResult<{ email?: string }>> => {
    const res = await fetch(`${API_BASE_URL}/auth/check-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = parseEnvelope(await res.json(), isEmailData);
    return { ok: res.ok, status: res.status, data };
  },

  loginWithPassword: async (
    email: string,
    password: string,
  ): Promise<AuthApiResult<AuthSession>> => {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });
    const data = parseEnvelope(await res.json(), isAuthSession);
    return { ok: res.ok, status: res.status, data };
  },

  completeTemporaryPassword: async (
    password: string,
    confirmPassword: string,
  ): Promise<AuthApiResult<TemporaryPasswordChangeData>> => {
    const res = await fetch(`${API_BASE_URL}/auth/first-login-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ password, confirmPassword }),
    });
    const data = parseEnvelope(await res.json(), isTemporaryPasswordChangeData);
    return { ok: res.ok, status: res.status, data };
  },

  requestPasswordReset: async (email: string): Promise<AuthApiResult<PasswordResetRequestData>> => {
    const res = await fetch(`${API_BASE_URL}/auth/password-reset/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = parseEnvelope(await res.json(), isPasswordResetRequestData);
    return { ok: res.ok, status: res.status, data };
  },

  completePasswordReset: async (
    token: string,
    password: string,
    confirmPassword: string,
  ): Promise<AuthApiResult<TemporaryPasswordChangeData>> => {
    const res = await fetch(`${API_BASE_URL}/auth/password-reset/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password, confirmPassword }),
    });
    const data = parseEnvelope(await res.json(), isTemporaryPasswordChangeData);
    return { ok: res.ok, status: res.status, data };
  },

  loginWithGoogle: async (
    credentialResponse: CredentialResponse,
  ): Promise<AuthApiResult<AuthSession>> => {
    const res = await fetch(`${API_BASE_URL}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ idToken: credentialResponse.credential }),
    });
    const data = parseEnvelope(await res.json(), isAuthSession);
    return { ok: res.ok, status: res.status, data };
  },

  getCurrentUser: async (): Promise<AuthApiResult<AuthSession>> => {
    const res = await fetch(`${API_BASE_URL}/auth/me`, {
      credentials: 'include',
    });
    const data = parseEnvelope(await res.json(), isAuthSession);
    return { ok: res.ok, status: res.status, data };
  },

  logout: async (): Promise<AuthApiResult<LogoutData>> => {
    const res = await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
    const data = parseEnvelope(await res.json(), isLogoutData);
    return { ok: res.ok, status: res.status, data };
  },

  validateSignup: async (
    payload: SignupValidationRequest,
  ): Promise<AuthApiResult<SignupValidationData>> => {
    const res = await fetch(`${API_BASE_URL}/auth/signup/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = parseEnvelope(await res.json(), isSignupValidationData);
    return { ok: res.ok, status: res.status, data };
  },

  createAccount: async (
    payload: Extract<SignupValidationRequest, { step: 'profile' }>,
  ): Promise<AuthApiResult<SignupCreationData>> => {
    const res = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = parseEnvelope(await res.json(), isSignupCreationData);
    return { ok: res.ok, status: res.status, data };
  },

  googleSignup: async (
    idToken: string,
    payload: Extract<SignupValidationRequest, { step: 'profile' }>,
  ): Promise<AuthApiResult<SignupCreationData>> => {
    const res = await fetch(`${API_BASE_URL}/auth/google/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken, ...payload }),
    });
    const data = parseEnvelope(await res.json(), isSignupCreationData);
    return { ok: res.ok, status: res.status, data };
  },
};
