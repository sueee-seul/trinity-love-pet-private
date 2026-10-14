import { createHash } from 'node:crypto';
import { jwtVerify, SignJWT, type JWTPayload } from 'jose';
import {
  createPetParentAccount,
  createGooglePetParentAccount,
  findPasswordHashById,
  findPasswordResetTargetByEmail,
  findUserByCredentials,
  findUserByEmail,
  findUserById,
  findUserByUsername,
  updateUserPasswordFromReset,
  updateUserPasswordFromTemporary,
  type CreatePetParentAccountInput,
  type CreateGooglePetParentAccountInput,
  type DatabaseAuthUser,
} from '../repositories/auth.repository.js';
import { verifyGoogleIdToken } from './google-token.verifier.js';

export type SignupConflictField = 'email' | 'username';

export class AuthSignupConflictError extends Error {
  public readonly field: SignupConflictField;

  constructor(field: SignupConflictField) {
    super('Signup identity is already registered');
    this.name = 'AuthSignupConflictError';
    this.field = field;
    Object.setPrototypeOf(this, AuthSignupConflictError.prototype);
  }
}

/** Google could not vouch for the address, so it cannot open or create an account here. */
export class UnverifiedGoogleEmailError extends Error {
  constructor() {
    super('Google has not verified this email address');
    this.name = 'UnverifiedGoogleEmailError';
    Object.setPrototypeOf(this, UnverifiedGoogleEmailError.prototype);
  }
}

const isUniqueViolation = (error: unknown): boolean => {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
};

const getSignupConflictField = (error: unknown): SignupConflictField => {
  if (
    typeof error === 'object' &&
    error !== null &&
    'constraint' in error &&
    error.constraint === 'users_username_key'
  ) {
    return 'username';
  }
  return 'email';
};

const PASSWORD_RESET_PURPOSE = 'password-reset';
const PASSWORD_RESET_TTL_SECONDS = 15 * 60;

interface PasswordResetClaims {
  sub: string;
  purpose: typeof PASSWORD_RESET_PURPOSE;
  pv: string;
  iat: number;
  exp: number;
}

const getAuthSigningSecret = (): Uint8Array => {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret) {
    throw new Error('AUTH_SESSION_SECRET is not configured');
  }

  return new TextEncoder().encode(secret);
};

const getPasswordHashFingerprint = (passwordHash: string): string => {
  return createHash('sha256').update(passwordHash).digest('base64url');
};

const isPasswordResetPayload = (
  payload: JWTPayload,
): payload is JWTPayload & PasswordResetClaims => {
  return (
    typeof payload.sub === 'string' &&
    payload.purpose === PASSWORD_RESET_PURPOSE &&
    typeof payload.pv === 'string' &&
    typeof payload.iat === 'number' &&
    typeof payload.exp === 'number'
  );
};

const createPasswordResetToken = async (
  userId: string,
  passwordHash: string,
  issuedAt = new Date(),
): Promise<string> => {
  const issuedAtSeconds = Math.floor(issuedAt.getTime() / 1000);
  return new SignJWT({
    purpose: PASSWORD_RESET_PURPOSE,
    pv: getPasswordHashFingerprint(passwordHash),
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(userId)
    .setIssuedAt(issuedAtSeconds)
    .setExpirationTime(issuedAtSeconds + PASSWORD_RESET_TTL_SECONDS)
    .sign(getAuthSigningSecret());
};

const verifyPasswordResetToken = async (token: string): Promise<PasswordResetClaims> => {
  const { payload } = await jwtVerify(token, getAuthSigningSecret(), {
    algorithms: ['HS256'],
    requiredClaims: ['sub', 'iat', 'exp', 'purpose', 'pv'],
  });

  if (!isPasswordResetPayload(payload)) {
    throw new Error('Invalid password reset token claims');
  }

  return {
    sub: payload.sub,
    purpose: payload.purpose,
    pv: payload.pv,
    iat: payload.iat,
    exp: payload.exp,
  };
};

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  is_employee: boolean;
  is_pet_owner: boolean;
  employee_role: 'manager' | 'staff' | null;
  isUsingTemporaryPassword: boolean;
}

export interface LoginResult {
  user: AuthenticatedUser;
}

export interface SignupResult {
  user: AuthenticatedUser;
}

export class AuthService {
  private static mapDatabaseStaffRole(
    staffRole: DatabaseAuthUser['staff_role'],
  ): AuthenticatedUser['employee_role'] {
    if (staffRole === 'manager' || staffRole === 'staff') {
      return staffRole;
    }

    return null;
  }

  private static toAuthenticatedUser(user: DatabaseAuthUser): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      is_employee: user.is_employee,
      is_pet_owner: user.is_pet_owner,
      employee_role: user.is_employee ? AuthService.mapDatabaseStaffRole(user.staff_role) : null,
      isUsingTemporaryPassword: user.is_temporary_password === true,
    };
  }

  static async checkEmail(email: string): Promise<string | null> {
    const user = await findUserByEmail(email.trim());
    return user?.email ?? null;
  }

  static async checkUsername(username: string): Promise<string | null> {
    const user = await findUserByUsername(username.trim());
    return user?.username ?? null;
  }

  static async login(email: string, password: string): Promise<LoginResult | null> {
    const user = await findUserByCredentials(email.trim(), password);
    if (!user) {
      return null;
    }

    const authenticatedUser = AuthService.toAuthenticatedUser(user);

    return { user: authenticatedUser };
  }

  static async completeTemporaryPasswordChange(userId: string, password: string): Promise<boolean> {
    const updated = await updateUserPasswordFromTemporary(userId, password);
    return updated !== null;
  }

  static async requestPasswordReset(email: string): Promise<string | null> {
    const target = await findPasswordResetTargetByEmail(email.trim());
    if (!target?.password_hash) {
      return null;
    }

    return createPasswordResetToken(target.id, target.password_hash);
  }

  static async completePasswordReset(token: string, password: string): Promise<boolean> {
    let claims: PasswordResetClaims;
    try {
      claims = await verifyPasswordResetToken(token);
    } catch {
      return false;
    }

    const currentPasswordHash = await findPasswordHashById(claims.sub);
    if (!currentPasswordHash || getPasswordHashFingerprint(currentPasswordHash) !== claims.pv) {
      return false;
    }

    return updateUserPasswordFromReset(claims.sub, currentPasswordHash, password);
  }

  static async findAuthenticatedUserById(id: string): Promise<AuthenticatedUser | null> {
    const user = await findUserById(id);
    return user ? AuthService.toAuthenticatedUser(user) : null;
  }

  static async signup(input: CreatePetParentAccountInput): Promise<SignupResult> {
    let createdAccount: Awaited<ReturnType<typeof createPetParentAccount>>;
    try {
      createdAccount = await createPetParentAccount(input);
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        throw new AuthSignupConflictError(getSignupConflictField(error));
      }
      throw error;
    }

    return {
      user: {
        id: createdAccount.id,
        email: createdAccount.email,
        name: createdAccount.name,
        is_employee: false,
        is_pet_owner: true,
        employee_role: null,
        isUsingTemporaryPassword: false,
      },
    };
  }

  static async loginWithGoogle(
    idToken: string,
    clientId: string,
  ): Promise<{
    isNewUser: boolean;
    user: AuthenticatedUser | { email: string; firstName: string; lastName: string };
  } | null> {
    const payload = await verifyGoogleIdToken(idToken, clientId);

    // Accounts are matched by email alone, so an address Google has not verified could open
    // someone else's account, a manager's included.
    if (!payload?.email || !payload.given_name || !payload.email_verified) {
      return null;
    }

    const email = payload.email.trim();
    const existingUser = await findUserByEmail(email);

    if (existingUser) {
      const authenticatedUser = AuthService.toAuthenticatedUser(existingUser);
      return {
        isNewUser: false,
        user: authenticatedUser,
      };
    }

    return {
      isNewUser: true,
      user: {
        email: email,
        firstName: payload.given_name,
        lastName: payload.family_name || '',
      },
    };
  }

  static async signupWithGoogle(
    idToken: string,
    clientId: string,
    profileData: Omit<CreateGooglePetParentAccountInput, 'email' | 'username'>,
  ): Promise<SignupResult> {
    const payload = await verifyGoogleIdToken(idToken, clientId);

    if (!payload?.email) {
      throw new Error('Invalid Google token');
    }
    if (!payload.email_verified) {
      throw new UnverifiedGoogleEmailError();
    }

    const email = payload.email.trim().toLowerCase();

    // Generate unique username based on email
    let baseUsername = (email.split('@')[0] || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!baseUsername) baseUsername = 'user';
    let username = baseUsername;
    let suffix = 1;
    while (await findUserByUsername(username)) {
      username = `${baseUsername}${suffix}`;
      suffix++;
    }

    let createdAccount: Awaited<ReturnType<typeof createGooglePetParentAccount>>;
    try {
      createdAccount = await createGooglePetParentAccount({
        ...profileData,
        email,
        username,
      });
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        throw new AuthSignupConflictError(getSignupConflictField(error));
      }
      throw error;
    }

    return {
      user: {
        id: createdAccount.id,
        email: createdAccount.email,
        name: createdAccount.name,
        is_employee: false,
        is_pet_owner: true,
        employee_role: null,
        isUsingTemporaryPassword: false,
      },
    };
  }
}
