import { describe, expect, it, vi } from 'vitest';
import { readFacilityCapacity } from '../repositories/booking.capacity.repository.js';
import {
  getConciergeStatus,
  readAssistantMode,
  readCapacityConfigured,
} from '../services/concierge/concierge.status.js';
import { FakeCardProcessor } from '../services/payments/fake-card-processor.js';

vi.mock('../repositories/booking.capacity.repository.js', () => ({
  readFacilityCapacity: vi.fn(),
}));

describe('readCapacityConfigured', () => {
  it('is false only when no single facility capacity exists; a database error is not that', async () => {
    vi.mocked(readFacilityCapacity).mockResolvedValueOnce(40);
    await expect(readCapacityConfigured()).resolves.toBe(true);
    vi.mocked(readFacilityCapacity).mockResolvedValueOnce(null);
    await expect(readCapacityConfigured()).resolves.toBe(false);
    vi.mocked(readFacilityCapacity).mockRejectedValueOnce(new Error('connection refused'));
    await expect(readCapacityConfigured()).resolves.toBe(true);
  });
});

describe('getConciergeStatus', () => {
  it('passes the capacity answer through, and assumes it is set up when not told', () => {
    expect(getConciergeStatus({}, null, false).capacityConfigured).toBe(false);
    expect(getConciergeStatus({}, null).capacityConfigured).toBe(true);
  });

  it('says email codes and card payments are off when nothing is configured', () => {
    expect(getConciergeStatus({ NODE_ENV: 'production' }, null)).toMatchObject({
      emailCodes: false,
      contact: { email: null, phone: null },
      cardPayments: { processor: null, testMode: false },
    });
  });

  it('says a card can be saved, and that the development fake is a test', () => {
    expect(getConciergeStatus({}, new FakeCardProcessor()).cardPayments).toEqual({
      processor: 'fake',
      testMode: true,
    });
  });

  it('states the fee rules the server charges by', () => {
    expect(getConciergeStatus({}, null).policy).toEqual({
      freeCancellationHours: 168,
      shortNoticeHours: 72,
      shortNoticeFeePercent: 50,
      reviewWindowHours: 24,
      lateFeeBasis: 'first_night',
    });
  });

  it('never reports console email as available in production', () => {
    expect(
      getConciergeStatus({ NODE_ENV: 'production', CONCIERGE_EMAIL_MODE: 'console' }).emailCodes,
    ).toBe(false);
    expect(
      getConciergeStatus({ NODE_ENV: 'development', CONCIERGE_EMAIL_MODE: 'console' }).emailCodes,
    ).toBe(true);
  });

  it('passes on the team contact only when it looks valid', () => {
    expect(
      getConciergeStatus({
        CONCIERGE_TEAM_EMAIL: ' bookings@wagstay.co.nz ',
        CONCIERGE_TEAM_PHONE: '09 555 0100',
      }).contact,
    ).toEqual({ email: 'bookings@wagstay.co.nz', phone: '09 555 0100' });
    expect(
      getConciergeStatus({ CONCIERGE_TEAM_EMAIL: 'not an email', CONCIERGE_TEAM_PHONE: '123' })
        .contact,
    ).toEqual({ email: null, phone: null });
  });
});

describe('getConciergeStatus aiProcessing', () => {
  it('says where the assistant and voice-to-text run, from the live configuration', () => {
    expect(getConciergeStatus({}, null).aiProcessing).toEqual({
      assistant: { kind: 'rules', region: null },
      speech: { kind: 'whisper', region: null },
      parentChat: { kind: 'other', region: null },
    });
    expect(
      getConciergeStatus(
        {
          CONCIERGE_AI_PROVIDER: 'anthropic',
          ANTHROPIC_API_KEY: 'secret-anthropic-key',
          SPEECH_PROVIDER: 'transcribe',
          TRANSCRIBE_AWS_REGION: 'ap-southeast-4',
        },
        null,
      ).aiProcessing,
    ).toEqual({
      assistant: { kind: 'anthropic', region: null },
      speech: { kind: 'transcribe', region: 'ap-southeast-4' },
      parentChat: { kind: 'other', region: null },
    });
  });
});

describe('readAssistantMode', () => {
  it('is the rules assistant by default, so the page never calls a keyword matcher an AI', () => {
    expect(readAssistantMode({})).toBe('rules');
    expect(getConciergeStatus({}, null).assistantMode).toBe('rules');
  });

  it('is Claude once Bedrock credentials exist, and null when Bedrock is asked for without them', () => {
    expect(
      readAssistantMode({ CONCIERGE_AI_PROVIDER: 'bedrock', CONCIERGE_BEDROCK_API_KEY: 'key' }),
    ).toBe('claude');
    expect(readAssistantMode({ CONCIERGE_AI_PROVIDER: 'bedrock' })).toBeNull();
    expect(readAssistantMode({ CONCIERGE_AI_PROVIDER: 'other' })).toBeNull();
  });
});
