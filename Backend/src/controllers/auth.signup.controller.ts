import type { Request, Response } from 'express';
import {
  googleSignupProfileSchema,
  signupProfileSchema,
  toSignupFieldErrors,
  validateSignupRequest,
} from '../contracts/auth.signup.contract.js';
import {
  AuthService,
  AuthSignupConflictError,
  UnverifiedGoogleEmailError,
} from '../services/auth.service.js';

const signupConflictResponse = (
  field: 'email' | 'username',
): {
  field: 'email' | 'username';
  code: string;
  message: string;
} => {
  if (field === 'username') {
    return {
      field: 'username',
      code: 'USERNAME_ALREADY_REGISTERED',
      message: 'This username is already registered.',
    };
  }

  return {
    field: 'email',
    code: 'EMAIL_ALREADY_REGISTERED',
    message: 'This email is already registered.',
  };
};

export const checkEmail = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { email } = req.body;
    if (typeof email !== 'string' || email.trim().length === 0) {
      return res.status(400).json({ code: 400, msg: 'Email is required', data: null });
    }

    const foundEmail = await AuthService.checkEmail(email);

    if (!foundEmail) {
      return res.status(404).json({ code: 404, msg: 'Email not registered.', data: null });
    }

    return res.status(200).json({ code: 200, msg: 'Email exists', data: { email: foundEmail } });
  } catch {
    return res.status(500).json({ code: 500, msg: 'Internal server error', data: null });
  }
};

export const signup = async (req: Request, res: Response): Promise<Response> => {
  const parsed = signupProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      code: 400,
      msg: 'Signup validation failed',
      data: { valid: false, fieldErrors: toSignupFieldErrors(parsed.error) },
    });
  }

  try {
    const { data } = parsed;
    const signupData = await AuthService.signup({
      email: data.email.toLowerCase(),
      username: data.username.toLowerCase(),
      password: data.password,
      emergencyContactNumber: data.emergencyContactNumber,
      firstName: data.firstName,
      lastName: data.lastName,
      address: data.address,
      dateOfBirth: data.dateOfBirth,
    });

    return res.status(201).json({
      code: 201,
      msg: 'Account created',
      data: signupData,
    });
  } catch (error: unknown) {
    if (error instanceof AuthSignupConflictError) {
      const conflict = signupConflictResponse(error.field);
      return res.status(409).json({
        code: 409,
        msg: conflict.message,
        data: {
          valid: false,
          fieldErrors: {
            [conflict.field]: [{ code: conflict.code, message: conflict.message }],
          },
        },
      });
    }

    console.error(
      'Signup Error:',
      error instanceof Error ? error.message : 'Unknown database error',
    );
    return res.status(500).json({ code: 500, msg: 'Internal server error', data: null });
  }
};

export const googleSignup = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { idToken } = req.body;

    if (typeof idToken !== 'string' || !idToken) {
      return res.status(400).json({ code: 400, msg: 'ID token is required', data: null });
    }

    const parsed = googleSignupProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        code: 400,
        msg: 'Signup validation failed',
        data: { valid: false, fieldErrors: toSignupFieldErrors(parsed.error) },
      });
    }

    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(500).json({ code: 500, msg: 'Server configuration error', data: null });
    }

    const signupData = await AuthService.signupWithGoogle(idToken, process.env.GOOGLE_CLIENT_ID, {
      emergencyContactNumber: parsed.data.emergencyContactNumber,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      address: parsed.data.address,
      dateOfBirth: parsed.data.dateOfBirth,
    });

    return res.status(201).json({
      code: 201,
      msg: 'Account created with Google',
      data: signupData,
    });
  } catch (error: unknown) {
    if (error instanceof AuthSignupConflictError) {
      return res.status(409).json({
        code: 409,
        msg: 'User is already registered or username collision',
        data: { valid: false, fieldErrors: {} },
      });
    }
    if (error instanceof UnverifiedGoogleEmailError) {
      return res.status(401).json({
        code: 401,
        msg: 'Google has not verified this email address',
        data: null,
      });
    }

    console.error(
      'Google Signup Error:',
      error instanceof Error ? error.message : 'Unknown authentication error',
    );
    return res.status(500).json({ code: 500, msg: 'Internal server error', data: null });
  }
};

export const validateSignup = async (req: Request, res: Response): Promise<Response> => {
  const result = validateSignupRequest(req.body);

  if (!result.success) {
    return res.status(400).json({
      code: 400,
      msg: 'Signup validation failed',
      data: { valid: false, fieldErrors: result.fieldErrors },
    });
  }

  const email = typeof req.body.email === 'string' ? req.body.email.trim() : '';
  const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';

  const fieldErrors: Record<string, Array<{ code: string; message: string }>> = {};

  if (email && (await AuthService.checkEmail(email))) {
    fieldErrors.email = [
      { code: 'EMAIL_ALREADY_REGISTERED', message: 'This email is already registered.' },
    ];
  }

  if (username && (await AuthService.checkUsername(username))) {
    fieldErrors.username = [
      { code: 'USERNAME_ALREADY_REGISTERED', message: 'This username is already registered.' },
    ];
  }

  if (Object.keys(fieldErrors).length > 0) {
    return res.status(409).json({
      code: 409,
      msg: 'Signup validation failed due to conflict',
      data: { valid: false, fieldErrors },
    });
  }

  return res.status(200).json({
    code: 200,
    msg: 'Signup validation passed',
    data: { valid: true, fieldErrors: {} },
  });
};
