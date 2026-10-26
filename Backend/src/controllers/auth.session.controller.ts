import type { Request, Response } from 'express';
import {
  temporaryPasswordChangeSchema,
  toSignupFieldErrors,
} from '../contracts/auth.signup.contract.js';
import { AuthService } from '../services/auth.service.js';
import {
  AUTH_COOKIE_NAME,
  createSessionToken,
  getAuthSessionCookieOptions,
} from '../services/auth.session.js';

const setAuthCookie = async (res: Response, userId: string): Promise<void> => {
  const token = await createSessionToken(userId);
  res.cookie(AUTH_COOKIE_NAME, token, getAuthSessionCookieOptions());
};

/** Every Google OAuth web client ID ends with this suffix. */
const GOOGLE_CLIENT_ID_SUFFIX = '.apps.googleusercontent.com';

/**
 * A placeholder such as "the_client_id_from_google" is treated as not configured. Google answers
 * an unknown client ID with an "access blocked" page, so the sign-in page should not offer a
 * button that can only fail.
 */
export const googleClientConfig = (_req: Request, res: Response): Response => {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  // Not configured is a normal answer, not a fault: the page hides Google sign-in and keeps the
  // email sign-in, without an error in the browser console.
  if (!clientId || !clientId.endsWith(GOOGLE_CLIENT_ID_SUFFIX)) {
    return res
      .status(200)
      .json({ code: 200, msg: 'Google sign-in is not configured', data: { clientId: null } });
  }

  return res.status(200).json({
    code: 200,
    msg: 'Google client config loaded',
    data: { clientId },
  });
};

export const login = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { email, password } = req.body;

    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      email.trim().length === 0 ||
      password.length === 0
    ) {
      return res
        .status(400)
        .json({ code: 400, msg: 'Email and password are required', data: null });
    }

    const loginData = await AuthService.login(email, password);

    if (!loginData) {
      return res.status(401).json({ code: 401, msg: 'Wrong password. Try again.', data: null });
    }

    await setAuthCookie(res, loginData.user.id);

    return res.status(200).json({
      code: 200,
      msg: 'Login successful',
      data: { user: loginData.user },
    });
  } catch (error: unknown) {
    console.error(
      'Login Error:',
      error instanceof Error ? error.message : 'Unknown authentication error',
    );
    return res.status(500).json({ code: 500, msg: 'Internal server error', data: null });
  }
};

export const googleLogin = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { idToken } = req.body;
    if (typeof idToken !== 'string' || !idToken) {
      return res.status(400).json({ code: 400, msg: 'ID token is required', data: null });
    }

    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(500).json({ code: 500, msg: 'Server configuration error', data: null });
    }

    const loginData = await AuthService.loginWithGoogle(idToken, process.env.GOOGLE_CLIENT_ID);
    if (!loginData) {
      return res.status(401).json({ code: 401, msg: 'Invalid Google token payload', data: null });
    }

    if (loginData.isNewUser) {
      return res.status(404).json({
        code: 404,
        msg: 'User not registered',
        action: 'REQUIRE_SIGNUP',
        data: loginData.user,
      });
    }

    if (!('id' in loginData.user)) {
      return res.status(401).json({ code: 401, msg: 'Invalid Google user', data: null });
    }

    await setAuthCookie(res, loginData.user.id);

    return res.status(200).json({
      code: 200,
      msg: 'Google login successful',
      data: { user: loginData.user },
    });
  } catch (error: unknown) {
    console.error(
      'Google Login Error:',
      error instanceof Error ? error.message : 'Unknown authentication error',
    );
    return res
      .status(500)
      .json({ code: 500, msg: 'Internal server error during Google login', data: null });
  }
};

export const getCurrentUser = (req: Request, res: Response): Response => {
  if (!req.user) {
    return res.status(401).json({ code: 401, msg: 'Authentication required', data: null });
  }

  return res.status(200).json({
    code: 200,
    msg: 'Current user loaded',
    data: { user: req.user },
  });
};

export const logout = (_req: Request, res: Response): Response => {
  res.clearCookie(AUTH_COOKIE_NAME, getAuthSessionCookieOptions());
  return res.status(200).json({
    code: 200,
    msg: 'Logged out',
    data: { loggedOut: true },
  });
};

export const completeTemporaryPasswordChange = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  const parsed = temporaryPasswordChangeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      code: 400,
      msg: 'Password validation failed',
      data: { fieldErrors: toSignupFieldErrors(parsed.error) },
    });
  }

  if (!req.user || req.user.isUsingTemporaryPassword !== true) {
    return res.status(409).json({
      code: 409,
      msg: 'Temporary password change is not available',
      data: null,
    });
  }

  try {
    const changed = await AuthService.completeTemporaryPasswordChange(
      req.user.id,
      parsed.data.password,
    );
    if (!changed) {
      return res.status(409).json({
        code: 409,
        msg: 'Temporary password change is no longer available',
        data: null,
      });
    }

    return res.status(200).json({
      code: 200,
      msg: 'Password updated',
      data: { passwordChanged: true },
    });
  } catch (error: unknown) {
    console.error(
      'Temporary password update failed:',
      error instanceof Error ? error.message : 'Unknown database error',
    );
    return res.status(500).json({ code: 500, msg: 'Unable to update password', data: null });
  }
};
