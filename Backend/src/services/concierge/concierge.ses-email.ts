import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import type { ConciergeEmailSender, OutboundEmail, VerificationEmail } from './concierge.email.js';

/**
 * Email through Amazon SES (v2 API), for CONCIERGE_EMAIL_MODE=ses.
 *
 * - CONCIERGE_EMAIL_FROM: the sender, an address or domain verified in SES, e.g.
 *   "Wagstay <bookings@wagstay.co.nz>". SES also needs production access to mail guests.
 * - CONCIERGE_SES_REGION: defaults to Sydney, next to the rest of the AWS services this project
 *   uses for guests' data.
 * - CONCIERGE_SES_ACCESS_KEY_ID and CONCIERGE_SES_SECRET_ACCESS_KEY: needed while the AWS_* keys
 *   belong to Neon object storage, because the SDK's default credential chain would pick those up
 *   and every send would fail with a signature error. Without Neon keys the default chain (the
 *   task or instance role on AWS) is used.
 */

export const DEFAULT_SES_REGION = 'ap-southeast-2';

/** "bookings@wagstay.co.nz" or "Wagstay <bookings@wagstay.co.nz>". */
const SENDER_SHAPE =
  /^(?:[^<>@\n]+ <[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+>|[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+)$/;

export interface SesConfiguration {
  region: string;
  from: string;
  credentials?: { accessKeyId: string; secretAccessKey: string };
}

/** The one call this sender makes, so tests can stand in for the SES client. */
export interface SesClient {
  send(command: SendEmailCommand): Promise<unknown>;
}

const readTrimmed = (
  environment: Record<string, string | undefined>,
  name: string,
): string | undefined => environment[name]?.trim() || undefined;

export const readSesConfiguration = (
  environment: Record<string, string | undefined>,
): SesConfiguration | { problem: string } => {
  const from = readTrimmed(environment, 'CONCIERGE_EMAIL_FROM');
  if (!from || !SENDER_SHAPE.test(from)) {
    return { problem: 'CONCIERGE_EMAIL_FROM must be a sender address verified in Amazon SES' };
  }
  const accessKeyId = readTrimmed(environment, 'CONCIERGE_SES_ACCESS_KEY_ID');
  const secretAccessKey = readTrimmed(environment, 'CONCIERGE_SES_SECRET_ACCESS_KEY');
  if (Boolean(accessKeyId) !== Boolean(secretAccessKey)) {
    return {
      problem:
        'CONCIERGE_SES_ACCESS_KEY_ID and CONCIERGE_SES_SECRET_ACCESS_KEY must be set together',
    };
  }
  const usesNeonKeys = Boolean(
    readTrimmed(environment, 'AWS_ENDPOINT_URL_S3') &&
    readTrimmed(environment, 'AWS_ACCESS_KEY_ID'),
  );
  if (!accessKeyId && usesNeonKeys) {
    return {
      problem:
        'AWS_ACCESS_KEY_ID is the Neon Object Storage key; set CONCIERGE_SES_ACCESS_KEY_ID and CONCIERGE_SES_SECRET_ACCESS_KEY for Amazon SES',
    };
  }
  return {
    region: readTrimmed(environment, 'CONCIERGE_SES_REGION') ?? DEFAULT_SES_REGION,
    from,
    ...(accessKeyId && secretAccessKey ? { credentials: { accessKeyId, secretAccessKey } } : {}),
  };
};

/** The code email. The code is left out of the subject, so it does not show on a locked phone. */
export const verificationEmailFor = (email: VerificationEmail): OutboundEmail => ({
  to: email.to,
  subject: 'Your Wagstay verification code',
  text: [
    'Your Wagstay verification code is:',
    '',
    email.code,
    '',
    `It works for ${email.expiresInMinutes} minutes. If you didn't ask for this code, you can ignore this email.`,
  ].join('\n'),
});

export class SesEmailSender implements ConciergeEmailSender {
  constructor(
    private readonly client: SesClient,
    private readonly from: string,
  ) {}

  static fromConfiguration(configuration: SesConfiguration): SesEmailSender {
    const client = new SESv2Client({
      region: configuration.region,
      ...(configuration.credentials ? { credentials: configuration.credentials } : {}),
    });
    return new SesEmailSender(client, configuration.from);
  }

  async sendVerificationCode(email: VerificationEmail): Promise<void> {
    await this.deliver(verificationEmailFor(email));
  }

  async sendBookingEmail(email: OutboundEmail): Promise<void> {
    await this.deliver(email);
  }

  private async deliver(email: OutboundEmail): Promise<void> {
    await this.client.send(
      new SendEmailCommand({
        FromEmailAddress: this.from,
        Destination: { ToAddresses: [email.to] },
        Content: {
          Simple: {
            Subject: { Data: email.subject, Charset: 'UTF-8' },
            Body: { Text: { Data: email.text, Charset: 'UTF-8' } },
          },
        },
      }),
    );
  }
}
