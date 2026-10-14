import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  temporaryPasswordChangeSchema,
  toSignupFieldErrors,
} from '../contracts/auth.signup.contract.js';
import { AuthService } from '../services/auth.service.js';

const PASSWORD_RESET_GENERIC_MESSAGE = 'If the account exists, a reset link has been prepared.';
const PASSWORD_RESET_INVALID_MESSAGE = 'This password reset link is invalid or has expired.';

const passwordResetRequestSchema = z.object({
  email: z.string().trim().email(),
});

const passwordResetTokenSchema = z.object({
  token: z.string().min(1),
});

const getLocalPasswordResetUrl = (req: Request, token: string): string => {
  const frontendOrigin = req.get('origin') ?? 'http://localhost:5173';
  const resetUrl = new URL('/reset-password', frontendOrigin);
  resetUrl.searchParams.set('token', token);
  return resetUrl.toString();
};

const canExposeLocalPasswordResetUrl = (): boolean => {
  return (
    process.env.NODE_ENV !== 'production' && process.env.EXPOSE_LOCAL_PASSWORD_RESET_URL === 'true'
  );
};

export const requestPasswordReset = async (req: Request, res: Response): Promise<Response> => {
  const parsed = passwordResetRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      code: 400,
      msg: 'Enter a valid email address.',
      data: null,
    });
  }

  try {
    const token = await AuthService.requestPasswordReset(parsed.data.email);
    const data =
      !canExposeLocalPasswordResetUrl() || !token
        ? {}
        : { resetUrl: getLocalPasswordResetUrl(req, token) };

    return res.status(200).json({
      code: 200,
      msg: PASSWORD_RESET_GENERIC_MESSAGE,
      data,
    });
  } catch (error: unknown) {
    console.error(
      'Password reset request failed:',
      error instanceof Error ? error.message : 'Unknown database error',
    );
    return res.status(500).json({
      code: 500,
      msg: 'Unable to prepare password reset',
      data: null,
    });
  }
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

export const completePasswordReset = async (req: Request, res: Response): Promise<Response> => {
  const tokenResult = passwordResetTokenSchema.safeParse(req.body);
  const passwordResult = temporaryPasswordChangeSchema.safeParse(req.body);

  if (!passwordResult.success) {
    return res.status(400).json({
      code: 400,
      msg: 'Password validation failed',
      data: { fieldErrors: toSignupFieldErrors(passwordResult.error) },
    });
  }

  if (!tokenResult.success) {
    return res.status(400).json({
      code: 400,
      msg: PASSWORD_RESET_INVALID_MESSAGE,
      data: null,
    });
  }

  try {
    const changed = await AuthService.completePasswordReset(
      tokenResult.data.token,
      passwordResult.data.password,
    );
    if (!changed) {
      return res.status(400).json({
        code: 400,
        msg: PASSWORD_RESET_INVALID_MESSAGE,
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
      'Password reset completion failed:',
      error instanceof Error ? error.message : 'Unknown database error',
    );
    return res.status(500).json({
      code: 500,
      msg: 'Unable to update password',
      data: null,
    });
  }
};
