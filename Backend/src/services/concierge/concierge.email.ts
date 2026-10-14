import { AppError } from '../../common/middlewares/error.middleware.js';
import { readSesConfiguration, SesEmailSender } from './concierge.ses-email.js';

/**
 * Outbound email for the concierge and the bookings it makes, behind one interface.
 *
 * - CONCIERGE_EMAIL_MODE=ses sends through Amazon SES from CONCIERGE_EMAIL_FROM (see
 *   concierge.ses-email.ts).
 * - CONCIERGE_EMAIL_MODE=console prints each message on the server console, for local development
 *   only. It is refused when NODE_ENV=production: a deployment must never write sign-in codes to
 *   its logs while telling the guest a code was sent.
 * - Anything else refuses loudly.
 *
 * Everything sent here is transactional (codes, drop-off reminders, card problems), so it needs no
 * marketing consent (UEMA 2007 / Spam Act 2003) and carries no marketing.
 */

export interface VerificationEmail {
  to: string;
  code: string;
  expiresInMinutes: number;
}

export interface OutboundEmail {
  to: string;
  subject: string;
  text: string;
}

export interface ConciergeEmailSender {
  sendVerificationCode(email: VerificationEmail): Promise<void>;
  /** A message about a booking, e.g. the drop-off reminder or a card that could not be held. */
  sendBookingEmail(email: OutboundEmail): Promise<void>;
}

/** "ava.mitchell@example.com" -> "av***@example.com", so console output is not a contact list. */
export const maskEmail = (email: string): string => {
  const [local = '', domain = ''] = email.split('@');
  return `${local.slice(0, 2)}***@${domain}`;
};

export class DevelopmentConsoleEmailSender implements ConciergeEmailSender {
  constructor(private readonly write: (line: string) => void = (line) => console.info(line)) {}

  async sendVerificationCode(email: VerificationEmail): Promise<void> {
    // Local development only (CONCIERGE_EMAIL_MODE=console): the code is printed so a developer
    // can finish the flow without an email provider.
    this.write(
      `[concierge dev email] verification code for ${maskEmail(email.to)}: ${email.code} (valid ${email.expiresInMinutes} min)`,
    );
  }

  async sendBookingEmail(email: OutboundEmail): Promise<void> {
    this.write(`[concierge dev email] to ${maskEmail(email.to)}: ${email.subject}\n${email.text}`);
  }
}

export const CONSOLE_EMAIL_MODE = 'console';
export const SES_EMAIL_MODE = 'ses';

export type EmailSetup = { sender: ConciergeEmailSender } | { problem: string };

/** The sender this environment allows, or why there is none (for the server log, not guests). */
export const readEmailSetup = (
  environment: Record<string, string | undefined> = process.env,
): EmailSetup => {
  const mode = environment.CONCIERGE_EMAIL_MODE?.trim();
  if (mode === SES_EMAIL_MODE) {
    const configuration = readSesConfiguration(environment);
    return 'problem' in configuration
      ? configuration
      : { sender: SesEmailSender.fromConfiguration(configuration) };
  }
  if (mode === CONSOLE_EMAIL_MODE) {
    return environment.NODE_ENV === 'production'
      ? { problem: 'CONCIERGE_EMAIL_MODE=console only works outside production' }
      : { sender: new DevelopmentConsoleEmailSender() };
  }
  return { problem: 'CONCIERGE_EMAIL_MODE is not set to ses (or to console in development)' };
};

export const createConciergeEmailSender = (
  environment: Record<string, string | undefined> = process.env,
): ConciergeEmailSender => {
  const setup = readEmailSetup(environment);
  if ('sender' in setup) return setup.sender;
  throw new AppError(
    'Email verification is not available yet. Please sign in or book with our team.',
    'CONCIERGE_EMAIL_NOT_CONFIGURED',
    503,
  );
};
