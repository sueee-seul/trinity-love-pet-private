import { SendEmailCommand } from '@aws-sdk/client-sesv2';
import { describe, expect, it, vi } from 'vitest';
import {
  DevelopmentConsoleEmailSender,
  readEmailSetup,
} from '../services/concierge/concierge.email.js';
import {
  readSesConfiguration,
  SesEmailSender,
  type SesClient,
} from '../services/concierge/concierge.ses-email.js';

const sesClient = (): SesClient & { send: ReturnType<typeof vi.fn> } => ({
  send: vi.fn<(command: SendEmailCommand) => Promise<unknown>>(async () => ({})),
});

describe('how email is sent', () => {
  it('uses Amazon SES from the configured sender, in Sydney unless told otherwise', () => {
    expect(
      readSesConfiguration({ CONCIERGE_EMAIL_FROM: 'Wagstay <bookings@wagstay.example>' }),
    ).toEqual({ region: 'ap-southeast-2', from: 'Wagstay <bookings@wagstay.example>' });

    const setup = readEmailSetup({
      CONCIERGE_EMAIL_MODE: 'ses',
      CONCIERGE_EMAIL_FROM: 'bookings@wagstay.example',
      CONCIERGE_SES_REGION: 'ap-southeast-4',
      CONCIERGE_SES_ACCESS_KEY_ID: 'AKIAEXAMPLE',
      CONCIERGE_SES_SECRET_ACCESS_KEY: 'example-secret',
      // Neon object storage keys are ignored once SES has its own.
      AWS_ENDPOINT_URL_S3: 'https://storage.example',
      AWS_ACCESS_KEY_ID: 'neon-key',
    });
    expect('sender' in setup ? setup.sender : setup.problem).toBeInstanceOf(SesEmailSender);
  });

  it.each([
    [{ CONCIERGE_EMAIL_MODE: 'ses' }, /CONCIERGE_EMAIL_FROM/],
    [{ CONCIERGE_EMAIL_MODE: 'ses', CONCIERGE_EMAIL_FROM: 'bookings' }, /CONCIERGE_EMAIL_FROM/],
    [
      {
        CONCIERGE_EMAIL_MODE: 'ses',
        CONCIERGE_EMAIL_FROM: 'bookings@wagstay.example',
        CONCIERGE_SES_ACCESS_KEY_ID: 'AKIAEXAMPLE',
      },
      /must be set together/,
    ],
    [
      {
        CONCIERGE_EMAIL_MODE: 'ses',
        CONCIERGE_EMAIL_FROM: 'bookings@wagstay.example',
        AWS_ENDPOINT_URL_S3: 'https://storage.example',
        AWS_ACCESS_KEY_ID: 'neon-key',
      },
      /Neon Object Storage key/,
    ],
    [{ CONCIERGE_EMAIL_MODE: 'console', NODE_ENV: 'production' }, /outside production/],
    [{}, /not set to ses/],
  ])('says why %o cannot send', (environment, reason) => {
    const setup = readEmailSetup(environment);
    expect('problem' in setup ? setup.problem : 'a sender').toMatch(reason);
  });
});

describe('SesEmailSender', () => {
  it('sends a booking email as plain UTF-8 text from the configured sender', async () => {
    const client = sesClient();
    await new SesEmailSender(client, 'Wagstay <bookings@wagstay.example>').sendBookingEmail({
      to: 'ava@example.test',
      subject: 'Your Wagstay stay starts Sat 12 Dec: what to bring',
      text: 'Hi Ava,',
    });

    const command: unknown = client.send.mock.calls[0]?.[0];
    expect(command).toBeInstanceOf(SendEmailCommand);
    expect((command as SendEmailCommand).input).toEqual({
      FromEmailAddress: 'Wagstay <bookings@wagstay.example>',
      Destination: { ToAddresses: ['ava@example.test'] },
      Content: {
        Simple: {
          Subject: { Data: 'Your Wagstay stay starts Sat 12 Dec: what to bring', Charset: 'UTF-8' },
          Body: { Text: { Data: 'Hi Ava,', Charset: 'UTF-8' } },
        },
      },
    });
  });

  it('keeps a verification code out of the subject line', async () => {
    const client = sesClient();
    await new SesEmailSender(client, 'bookings@wagstay.example').sendVerificationCode({
      to: 'ava@example.test',
      code: '482913',
      expiresInMinutes: 10,
    });

    const { input } = client.send.mock.calls[0]?.[0] as SendEmailCommand;
    expect(input.Content?.Simple?.Subject?.Data).toBe('Your Wagstay verification code');
    expect(input.Content?.Simple?.Body?.Text?.Data).toContain('\n482913\n');
    expect(input.Content?.Simple?.Body?.Text?.Data).toContain('It works for 10 minutes.');
  });
});

describe('DevelopmentConsoleEmailSender', () => {
  it('prints a booking email with the address masked', async () => {
    const lines: string[] = [];
    await new DevelopmentConsoleEmailSender((line) => lines.push(line)).sendBookingEmail({
      to: 'ava.mitchell@example.test',
      subject: 'Your Wagstay stay starts Sat 12 Dec: what to bring',
      text: 'Hi Ava,',
    });

    expect(lines).toEqual([
      '[concierge dev email] to av***@example.test: Your Wagstay stay starts Sat 12 Dec: what to bring\nHi Ava,',
    ]);
  });
});
