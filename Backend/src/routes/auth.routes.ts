import { Router, type Request } from 'express';
import {
  googleClientConfig,
  googleLogin,
  googleSignup,
  login,
  signup,
  checkEmail,
  completeTemporaryPasswordChange,
  validateSignup,
  getCurrentUser,
  logout,
  requestPasswordReset,
  completePasswordReset,
} from '../controllers/auth.controller.js';
import {
  requireAuth,
  requireEmployee,
  requireTrustedOrigin,
} from '../common/middlewares/auth.middleware.js';
import { rateLimit } from '../common/middlewares/rate-limit.middleware.js';

const MINUTE_MS = 60_000;
const QUARTER_HOUR_MS = 15 * MINUTE_MS;
const HOUR_MS = 60 * MINUTE_MS;

/** The email a sign-in or reset request is about, so one account's budget follows it everywhere. */
const requestedEmail = (req: Request): string | undefined => {
  const email: unknown = (req.body as { email?: unknown } | undefined)?.email;
  return typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : undefined;
};

// Per address: enough for a household or an office behind one router, too few for a script.
const loginPerAddress = rateLimit({ name: 'auth-login', limit: 20, windowMs: QUARTER_HOUR_MS });
const checkEmailPerAddress = rateLimit({
  name: 'auth-check-email',
  limit: 30,
  windowMs: QUARTER_HOUR_MS,
});
const signupPerAddress = rateLimit({ name: 'auth-signup', limit: 10, windowMs: HOUR_MS });
const signupStepPerAddress = rateLimit({
  name: 'auth-signup-validate',
  limit: 60,
  windowMs: QUARTER_HOUR_MS,
});
const googlePerAddress = rateLimit({ name: 'auth-google', limit: 20, windowMs: QUARTER_HOUR_MS });
const resetRequestPerAddress = rateLimit({
  name: 'auth-reset-request',
  limit: 5,
  windowMs: HOUR_MS,
});
const resetCompletePerAddress = rateLimit({
  name: 'auth-reset-complete',
  limit: 10,
  windowMs: QUARTER_HOUR_MS,
});

// Per account: password guessing spread over many addresses still meets one ceiling.
const loginPerEmail = rateLimit({
  name: 'auth-login-email',
  limit: 10,
  windowMs: QUARTER_HOUR_MS,
  keyOf: requestedEmail,
});
const resetRequestPerEmail = rateLimit({
  name: 'auth-reset-request-email',
  limit: 3,
  windowMs: HOUR_MS,
  keyOf: requestedEmail,
});

const router = Router();

// Every sign-in route checks the Origin header too, so another site cannot sign a visitor in
// to an account of its choosing (login CSRF).
router.get('/google/config', googleClientConfig);
router.post('/google', requireTrustedOrigin, googlePerAddress, googleLogin);
router.post('/google/signup', requireTrustedOrigin, googlePerAddress, googleSignup);
router.get('/me', requireAuth, getCurrentUser);
router.post('/logout', logout);
router.post('/check-email', requireTrustedOrigin, checkEmailPerAddress, checkEmail);
router.post('/login', requireTrustedOrigin, loginPerAddress, loginPerEmail, login);
router.post(
  '/password-reset/request',
  requireTrustedOrigin,
  resetRequestPerAddress,
  resetRequestPerEmail,
  requestPasswordReset,
);
router.post(
  '/password-reset/complete',
  requireTrustedOrigin,
  resetCompletePerAddress,
  completePasswordReset,
);
router.post(
  '/first-login-password',
  requireEmployee,
  requireTrustedOrigin,
  completeTemporaryPasswordChange,
);
router.post('/signup', requireTrustedOrigin, signupPerAddress, signup);
router.post('/signup/validate', requireTrustedOrigin, signupStepPerAddress, validateSignup);

export default router;
