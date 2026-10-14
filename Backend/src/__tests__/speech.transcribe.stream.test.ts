import { describe, expect, it } from 'vitest';
import type { TranscriptResultStream } from '@aws-sdk/client-transcribe-streaming';
import {
  DEFAULT_TRANSCRIBE_LANGUAGE_OPTIONS,
  getTranscribeStreamConfiguration,
  mapTranscriptResultStreamEvent,
} from '../services/speech.transcribe.stream.js';
import { SpeechProviderError } from '../services/speech.streamer.js';

describe('getTranscribeStreamConfiguration', () => {
  it('identifies the language by default and prefers the first option', () => {
    const configuration = getTranscribeStreamConfiguration({
      TRANSCRIBE_AWS_REGION: 'ap-southeast-2',
      TRANSCRIBE_AWS_ACCESS_KEY_ID: 'AKIA-test',
      TRANSCRIBE_AWS_SECRET_ACCESS_KEY: 'secret',
    });

    expect(configuration).toEqual({
      region: 'ap-southeast-2',
      credentials: { accessKeyId: 'AKIA-test', secretAccessKey: 'secret' },
      languageOptions: DEFAULT_TRANSCRIBE_LANGUAGE_OPTIONS,
      preferredLanguage: 'en-US',
      sampleRateHertz: 16_000,
    });
  });

  it('forces one language when TRANSCRIBE_LANGUAGE_CODE is set', () => {
    const configuration = getTranscribeStreamConfiguration({
      TRANSCRIBE_AWS_REGION: 'ap-southeast-2',
      TRANSCRIBE_LANGUAGE_CODE: 'en-AU',
    });

    expect(configuration.languageCode).toBe('en-AU');
    expect(configuration.credentials).toBeUndefined();
  });

  // AWS_REGION is the Neon object storage region here (us-east-2); following it would send voices
  // to the United States while the notice says Australia.
  it('never falls back to AWS_REGION and defaults to Sydney', () => {
    const configuration = getTranscribeStreamConfiguration({ AWS_REGION: 'us-east-2' });

    expect(configuration.region).toBe('ap-southeast-2');
  });

  it('refuses a region outside Australia and New Zealand', () => {
    expect(() => getTranscribeStreamConfiguration({ TRANSCRIBE_AWS_REGION: 'us-east-1' })).toThrow(
      /Australia\/New Zealand region/,
    );
  });

  it('accepts a custom option list and preferred language', () => {
    const configuration = getTranscribeStreamConfiguration({
      TRANSCRIBE_AWS_REGION: 'ap-southeast-2',
      TRANSCRIBE_LANGUAGE_OPTIONS: ' en-AU, zh-CN ,ko-KR',
      TRANSCRIBE_PREFERRED_LANGUAGE: 'zh-CN',
    });

    expect(configuration.languageOptions).toEqual(['en-AU', 'zh-CN', 'ko-KR']);
    expect(configuration.preferredLanguage).toBe('zh-CN');
  });

  it('requires both halves of an explicit key pair', () => {
    expect(() =>
      getTranscribeStreamConfiguration({
        TRANSCRIBE_AWS_REGION: 'ap-southeast-2',
        TRANSCRIBE_AWS_ACCESS_KEY_ID: 'AKIA-test',
      }),
    ).toThrow(/set together/);
  });

  // The project's AWS_ACCESS_KEY_ID is a Neon Object Storage key; letting the SDK fall back to it
  // would fail every session with a signature error that says nothing about the real cause.
  it('refuses to fall back to the Neon object storage keys', () => {
    expect(() =>
      getTranscribeStreamConfiguration({
        AWS_REGION: 'us-east-2',
        AWS_ENDPOINT_URL_S3: 'https://storage.neon.example',
        AWS_ACCESS_KEY_ID: 'neon-key',
        AWS_SECRET_ACCESS_KEY: 'neon-secret',
      }),
    ).toThrow(/Neon Object Storage key/);
  });

  it('needs at least two options to identify a language', () => {
    expect(() =>
      getTranscribeStreamConfiguration({
        TRANSCRIBE_AWS_REGION: 'ap-southeast-2',
        TRANSCRIBE_LANGUAGE_OPTIONS: 'en-AU',
      }),
    ).toThrow(/at least two/);
  });

  it('rejects a preferred language outside the options', () => {
    expect(() =>
      getTranscribeStreamConfiguration({
        TRANSCRIBE_AWS_REGION: 'ap-southeast-2',
        TRANSCRIBE_PREFERRED_LANGUAGE: 'fr-FR',
      }),
    ).toThrow(/must be one of/);
  });
});

describe('mapTranscriptResultStreamEvent', () => {
  it('turns transcript events into segments and skips empty alternatives', () => {
    const event: TranscriptResultStream = {
      TranscriptEvent: {
        Transcript: {
          Results: [
            {
              ResultId: 'r1',
              IsPartial: true,
              LanguageCode: 'en-US',
              Alternatives: [{ Transcript: ' Bobo is ' }],
            },
            { ResultId: 'r2', IsPartial: false, Alternatives: [{ Transcript: '' }] },
            { ResultId: 'r3', IsPartial: false, Alternatives: [{ Transcript: 'Bobo is a dog.' }] },
          ],
        },
      },
    };

    expect(mapTranscriptResultStreamEvent(event)).toEqual([
      { text: 'Bobo is', isPartial: true, resultId: 'r1', languageCode: 'en-US' },
      { text: 'Bobo is a dog.', isPartial: false, resultId: 'r3' },
    ]);
  });

  it('returns nothing for an empty event', () => {
    expect(mapTranscriptResultStreamEvent({ TranscriptEvent: {} })).toEqual([]);
  });

  it('throws a retryable error for a service outage and a terminal one for a bad request', () => {
    const outage = {
      ServiceUnavailableException: { name: 'ServiceUnavailableException', message: 'try later' },
    } as unknown as TranscriptResultStream;
    expect(() => mapTranscriptResultStreamEvent(outage)).toThrow(SpeechProviderError);
    expect(() => mapTranscriptResultStreamEvent(outage)).toThrow(
      expect.objectContaining({ retryable: true }),
    );

    const badRequest = {
      BadRequestException: { name: 'BadRequestException', message: 'bad sample rate' },
    } as unknown as TranscriptResultStream;
    expect(() => mapTranscriptResultStreamEvent(badRequest)).toThrow(
      expect.objectContaining({ retryable: false, message: 'bad sample rate' }),
    );
  });
});
