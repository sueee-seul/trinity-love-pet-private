import { SpeechConfigurationError, type TranscribeStreamer } from './speech.streamer.js';
import {
  createAmazonTranscribeStreamer,
  getTranscribeStreamConfiguration,
} from './speech.transcribe.stream.js';
import { createWhisperServiceClient, getWhisperServiceUrl } from './speech.whisper.client.js';
import { createWhisperStreamer } from './speech.whisper.stream.js';

/**
 * Chooses the speech-to-text provider from `SPEECH_PROVIDER`.
 *
 * `whisper` (the default) uses the local service in `SpeechService/` and needs no cloud account.
 * `transcribe` keeps Amazon Transcribe Streaming available for a deployment that may use AWS.
 */

export const SPEECH_PROVIDERS = ['whisper', 'transcribe'] as const;
export type SpeechProviderName = (typeof SPEECH_PROVIDERS)[number];
export const DEFAULT_SPEECH_PROVIDER: SpeechProviderName = 'whisper';

type EnvironmentVariables = Record<string, string | undefined>;

const isSpeechProviderName = (value: string): value is SpeechProviderName =>
  (SPEECH_PROVIDERS as readonly string[]).includes(value);

export const getSpeechProviderName = (
  env: EnvironmentVariables = process.env,
): SpeechProviderName => {
  const configured = env.SPEECH_PROVIDER?.trim().toLowerCase() || DEFAULT_SPEECH_PROVIDER;
  if (!isSpeechProviderName(configured)) {
    throw new SpeechConfigurationError(
      `SPEECH_PROVIDER must be one of ${SPEECH_PROVIDERS.join(', ')}`,
    );
  }
  return configured;
};

const logToConsole = (message: string, detail?: unknown): void => console.error(message, detail);

export const createSpeechStreamer = (
  env: EnvironmentVariables = process.env,
): TranscribeStreamer => {
  if (getSpeechProviderName(env) === 'transcribe') {
    return createAmazonTranscribeStreamer(getTranscribeStreamConfiguration(env));
  }
  return createWhisperStreamer({
    client: createWhisperServiceClient({ baseUrl: getWhisperServiceUrl(env) }),
    log: logToConsole,
  });
};

let defaultStreamer: TranscribeStreamer | null = null;

/** Built once from the environment on first use, so a misconfiguration surfaces per session rather than at boot. */
export const getDefaultSpeechStreamer = (): TranscribeStreamer => {
  if (!defaultStreamer) {
    defaultStreamer = createSpeechStreamer();
  }
  return defaultStreamer;
};
