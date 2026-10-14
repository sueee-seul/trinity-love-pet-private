import type { Request, Response } from 'express';
import { ReviewerService } from '../services/reviewer.service.js';
import {
  createReviewerSessionToken,
  getReviewerSessionCookieOptions,
  REVIEWER_COOKIE_NAME,
} from '../services/reviewer.session.js';

export const googleReviewerLogin = async (req: Request, res: Response): Promise<Response> => {
  const { authorizationCode } = req.body;
  if (typeof authorizationCode !== 'string' || authorizationCode.length === 0) {
    return res.status(400).json({ code: 400, msg: 'Authorization code is required', data: null });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = req.get('origin');
  if (!clientId || !clientSecret || !redirectUri) {
    return res.status(500).json({ code: 500, msg: 'Server configuration error', data: null });
  }

  try {
    const reviewer = await ReviewerService.authenticateWithGoogleCode(
      authorizationCode,
      clientId,
      clientSecret,
      redirectUri,
    );
    if (!reviewer) {
      return res.status(401).json({ code: 401, msg: 'Invalid Google reviewer token', data: null });
    }

    const sessionToken = await createReviewerSessionToken(reviewer);
    res.cookie(REVIEWER_COOKIE_NAME, sessionToken, getReviewerSessionCookieOptions());
    return res.status(200).json({
      code: 200,
      msg: 'Reviewer login successful',
      data: { reviewer },
    });
  } catch {
    return res.status(500).json({
      code: 500,
      msg: 'Internal server error during reviewer login',
      data: null,
    });
  }
};

export const getCurrentReviewer = (req: Request, res: Response): Response => {
  if (!req.reviewer) {
    return res.status(401).json({ code: 401, msg: 'Reviewer authentication required', data: null });
  }

  return res.status(200).json({
    code: 200,
    msg: 'Current reviewer loaded',
    data: { reviewer: req.reviewer },
  });
};

export const logoutReviewer = (_req: Request, res: Response): Response => {
  res.clearCookie(REVIEWER_COOKIE_NAME, getReviewerSessionCookieOptions());
  return res.status(200).json({
    code: 200,
    msg: 'Reviewer logged out',
    data: { loggedOut: true },
  });
};
