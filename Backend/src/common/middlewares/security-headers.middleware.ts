import type { NextFunction, Request, Response } from 'express';

/** One year, the HSTS age browsers and preload lists expect. */
const HSTS_MAX_AGE_SECONDS = 31_536_000;

/**
 * Baseline response headers for an API that only returns JSON, images, audio and PDFs.
 *
 * No site may frame a response. The content policy sets only `frame-ancestors`: vaccination
 * certificates and task photos open in their own tab, and a deny-all policy can stop the browser's
 * own PDF and image viewers there. `nosniff` stops a browser from running an uploaded file as script.
 * HSTS is sent only in production: there the API is served over HTTPS, while local development is
 * plain HTTP and the header would pin localhost to HTTPS in the developer's browser.
 */
export const securityHeaders = (_req: Request, res: Response, next: NextFunction): void => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
  if (process.env.NODE_ENV === 'production') {
    res.setHeader(
      'Strict-Transport-Security',
      `max-age=${HSTS_MAX_AGE_SECONDS}; includeSubDomains`,
    );
  }
  next();
};
