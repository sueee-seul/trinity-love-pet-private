import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { AppError } from '../../common/middlewares/error.middleware.js';
import type { ConciergeEmailSender } from './concierge.email.js';

/**
 * One-time email codes that prove a guest controls an address before an account is created for
 * it, an order is attached to it, or they are signed in to it. Verifying ownership first is what
 * stops the account pre-hijacking attack (USENIX Security 2022) and stops a mistyped address from
 * receiving someone else's pet photos and schedule.
 *
 * Because a correct code signs someone in, guessing is limited per email, not just per code:
 * failures accumulate across resends, and an address that keeps failing is locked for a day.
 * Starts are limited per email too, so nobody can flood an inbox from many addresses.
 *
 * Codes live in memory, hashed, per process: fine for one server, and the documented next step is
 * a shared store once the API runs on more than one instance. Nothing here reveals whether an
 * address already has an account - that is only decided after the code is proven.
 */

export const CODE_TTL_MS = 10 * 60 * 1000;
export const RESEND_COOLDOWN_MS = 60 * 1000;
/** Wrong guesses allowed on one code before it is thrown away. */
export const MAX_ATTEMPTS_PER_CODE = 5;
/** Wrong guesses allowed for one email, across every code sent to it, within the window. */
export const MAX_FAILURES_PER_EMAIL = 10;
/** Codes one email may be sent within the window. */
export const MAX_STARTS_PER_EMAIL = 5;
export const START_WINDOW_MS = 60 * 60 * 1000;
export const FAILURE_WINDOW_MS = 24 * 60 * 60 * 1000;
/**
 * The first lock after MAX_FAILURES_PER_EMAIL wrong codes; each further round doubles it, up to the
 * failure window. Guessing stays bounded, but a stranger can no longer shut a passwordless owner
 * out of their account for a whole day with a dozen requests.
 */
export const FIRST_LOCK_MS = 15 * 60 * 1000;
const CODE_DIGITS = 6;
const CODE_SPACE = 10 ** CODE_DIGITS;

interface PendingCode {
  codeHash: Buffer;
  expiresAt: number;
  sentAt: number;
  attemptsLeft: number;
}

/** Per-email history that outlives any single code. */
interface EmailHistory {
  startTimes: number[];
  failureTimes: number[];
}

export interface VerificationStoreOptions {
  secret: string;
  /** Only codes are sent from here. */
  sender: Pick<ConciergeEmailSender, 'sendVerificationCode'>;
  now?: () => number;
  generateCode?: () => string;
}

const defaultCode = (): string => String(randomInt(0, CODE_SPACE)).padStart(CODE_DIGITS, '0');

const codeRejected = (): AppError =>
  new AppError(
    'That code is not right or has expired. Please request a new one.',
    'CONCIERGE_CODE_INVALID',
    400,
  );

const emailLocked = (): AppError =>
  new AppError(
    'Too many wrong codes for this email. Please try again tomorrow or contact our team.',
    'CONCIERGE_CODE_LOCKED',
    429,
  );

const within = (times: number[], now: number, windowMs: number): number[] =>
  times.filter((time) => now - time < windowMs);

export class ConciergeVerificationStore {
  private readonly pending = new Map<string, PendingCode>();
  private readonly history = new Map<string, EmailHistory>();
  private readonly now: () => number;
  private readonly generateCode: () => string;

  constructor(private readonly options: VerificationStoreOptions) {
    this.now = options.now ?? ((): number => Date.now());
    this.generateCode = options.generateCode ?? defaultCode;
  }

  private hash(email: string, code: string): Buffer {
    return createHmac('sha256', this.options.secret).update(`${email}\u0000${code}`).digest();
  }

  private historyFor(email: string, now: number): EmailHistory {
    const existing = this.history.get(email);
    const trimmed: EmailHistory = {
      startTimes: within(existing?.startTimes ?? [], now, START_WINDOW_MS),
      failureTimes: within(existing?.failureTimes ?? [], now, FAILURE_WINDOW_MS),
    };
    this.history.set(email, trimmed);
    return trimmed;
  }

  private sweep(now: number): void {
    for (const [email, entry] of this.pending) {
      if (entry.expiresAt <= now) this.pending.delete(email);
    }
    for (const [email, entry] of this.history) {
      const idle =
        within(entry.startTimes, now, START_WINDOW_MS).length === 0 &&
        within(entry.failureTimes, now, FAILURE_WINDOW_MS).length === 0;
      if (idle) this.history.delete(email);
    }
  }

  private isLocked(history: EmailHistory, now: number): boolean {
    const failures = history.failureTimes.length;
    if (failures < MAX_FAILURES_PER_EMAIL) {
      return false;
    }
    const round = Math.floor(failures / MAX_FAILURES_PER_EMAIL);
    const lockMs = Math.min(FIRST_LOCK_MS * 2 ** (round - 1), FAILURE_WINDOW_MS);
    return now - Math.max(...history.failureTimes) < lockMs;
  }

  /** Sends a fresh code. Resends are rate limited and never restore spent attempts. */
  async start(email: string): Promise<void> {
    const now = this.now();
    this.sweep(now);
    const history = this.historyFor(email, now);
    if (this.isLocked(history, now)) {
      throw emailLocked();
    }

    const existing = this.pending.get(email);
    if (existing && now - existing.sentAt < RESEND_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((RESEND_COOLDOWN_MS - (now - existing.sentAt)) / 1000);
      throw new AppError(
        `Please wait ${waitSeconds} seconds before asking for another code.`,
        'CONCIERGE_CODE_COOLDOWN',
        429,
        [{ retryAfterSeconds: waitSeconds }],
      );
    }
    if (history.startTimes.length >= MAX_STARTS_PER_EMAIL) {
      throw new AppError(
        'Too many codes requested for this email. Please try again in an hour.',
        'CONCIERGE_CODE_TOO_MANY',
        429,
      );
    }

    const code = this.generateCode();
    await this.options.sender.sendVerificationCode({
      to: email,
      code,
      expiresInMinutes: CODE_TTL_MS / 60000,
    });
    history.startTimes.push(now);
    // A resend replaces the code but keeps the attempts already spent on the previous one.
    const attemptsLeft = existing ? existing.attemptsLeft : MAX_ATTEMPTS_PER_CODE;
    this.pending.set(email, {
      codeHash: this.hash(email, code),
      expiresAt: now + CODE_TTL_MS,
      sentAt: now,
      attemptsLeft: Math.max(attemptsLeft, 1),
    });
  }

  /** Consumes the code on success; each wrong guess counts against the code and the email. */
  confirm(email: string, code: string): void {
    const now = this.now();
    const history = this.historyFor(email, now);
    if (this.isLocked(history, now)) {
      this.pending.delete(email);
      throw emailLocked();
    }

    const entry = this.pending.get(email);
    if (!entry || entry.expiresAt <= now) {
      this.pending.delete(email);
      throw codeRejected();
    }
    // A spent code stays until it expires, so the resend cooldown and the carried-over attempts
    // still apply; it can no longer be guessed.
    if (entry.attemptsLeft <= 0) {
      throw codeRejected();
    }

    const matches = timingSafeEqual(entry.codeHash, this.hash(email, code));
    if (!matches) {
      history.failureTimes.push(now);
      entry.attemptsLeft -= 1;
      throw this.isLocked(history, now) ? emailLocked() : codeRejected();
    }
    this.pending.delete(email);
  }
}
