import { describe, expect, it } from 'vitest';
import { createSpeechStreamer, getSpeechProviderName } from '../services/speech.provider.js';
import { SpeechConfigurationError } from '../services/speech.streamer.js';

describe('getSpeechProviderName', () => {
  it('uses the local Whisper service unless told otherwise', () => {
    expect(getSpeechProviderName({})).toBe('whisper');
    expect(getSpeechProviderName({ SPEECH_PROVIDER: ' Transcribe ' })).toBe('transcribe');
  });

  it('refuses an unknown provider', () => {
    expect(() => getSpeechProviderName({ SPEECH_PROVIDER: 'openai' })).toThrow(
      SpeechConfigurationError,
    );
  });
});

describe('createSpeechStreamer', () => {
  it('builds the Whisper streamer without any cloud credentials', () => {
    expect(createSpeechStreamer({})).toHaveProperty('transcribe');
  });

  it('still validates Transcribe settings when Transcribe is chosen', () => {
    expect(() =>
      createSpeechStreamer({ SPEECH_PROVIDER: 'transcribe', TRANSCRIBE_AWS_REGION: 'us-east-1' }),
    ).toThrow(SpeechConfigurationError);
  });
});
