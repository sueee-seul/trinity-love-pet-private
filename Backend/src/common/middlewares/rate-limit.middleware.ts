import type { NextFunction, Request, Response } from 'express';

/**
 * A budget for the endpoints that cost money to serve or that guard an account.
 *
 * A model-backed route bills per call, and billable plus no ceiling is how an API key gets drained.
 * A sign-in route with no ceiling allows unlimited password guessing (Privacy Act IPP 5 expects
 * reasonable safeguards). So the ceiling goes here.
 *
 * In memory and per process. That is enough for what this defends against - one client hammering
 * one server - and a shared store would mean new infrastructure for a class project. It resets on
 * restart, which is a real limit worth knowing rather than pretending otherwise.
 */

interface Bucket {
  count: number;
  /** Epoch millis when this window ends and the count goes back to zero. */
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Exposed for tests; the map holds counters, never anything about a person. */
export const resetRateLimits = (): void => buckets.clear();

/**
 * Old windows are swept on write rather than on a timer, so an idle process holds nothing and there
 * is no interval keeping it awake.
 */
const sweep = (now: number): void => {
  if (buckets.size < 1000) {
    return;
  }
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
};

interface RateLimitOptions {
  /** How many requests one client may make per window. */
  limit: number;
  windowMs: number;
  /** Distinguishes one route's budget from another's. */
  name: string;
  /**
   * Who the budget belongs to, when it is not the visitor. A sign-in route passes the email being
   * tried, so guessing one account's password from many addresses still meets one ceiling.
   * Returning undefined skips this budget and leaves a malformed request to the route's validation.
   */
  keyOf?: (req: Request) => string | undefined;
}

/**
 * A signed-in visitor gets their own budget; everyone else shares one per address. `req.ip`
 * honours Express's trust-proxy setting, so it is the client rather than the load balancer.
 */
const visitorIdentity = (req: Request): string => req.user?.id ?? req.ip ?? 'unknown';

// The two parts are joined by NUL, which cannot occur in a route name, an address or an email, so
// no pair of inputs can collide on one key. It is written as an escape so the file stays text to git.
const budgetKey = (name: string, identity: string): string => `${name}\u0000${identity}`;

export const rateLimit = (
  options: RateLimitOptions,
): ((req: Request, res: Response, next: NextFunction) => void) => {
  return (req, res, next) => {
    const now = Date.now();
    sweep(now);

    const identity = options.keyOf ? options.keyOf(req) : visitorIdentity(req);
    if (identity === undefined) {
      next();
      return;
    }

    const key = budgetKey(options.name, identity);
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }

    if (bucket.count >= options.limit) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({
        code: 429,
        msg: `Too many requests. Try again in ${retryAfter} second${retryAfter === 1 ? '' : 's'}.`,
        data: null,
      });
      return;
    }

    bucket.count += 1;
    next();
  };
};
