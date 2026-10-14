import {
  StartStreamTranscriptionCommand,
  TranscribeStreamingClient,
  type AudioStream,
  type LanguageCode,
  type TranscriptResultStream,
} from '@aws-sdk/client-transcribe-streaming';
import { SPEECH_SAMPLE_RATE_HERTZ } from '../contracts/speech.contract.js';
import {
  SpeechConfigurationError,
  SpeechProviderError,
  type TranscribeStreamer,
  type TranscriptSegment,
} from './speech.streamer.js';

/**
 * Amazon Transcribe Streaming as a `TranscribeStreamer`. Selected with `SPEECH_PROVIDER=transcribe`;
 * the default provider is the local Whisper service (see `speech.provider.ts`).
 */

export interface TranscribeStreamConfiguration {
  region: string;
  credentials?: { accessKeyId: string; secretAccessKey: string };
  /** When set, every session is transcribed in this one language. */
  languageCode?: string;
  /** Otherwise Transcribe identifies the spoken language among these. */
  languageOptions: string[];
  preferredLanguage: string;
  sampleRateHertz: number;
}

/**
 * The pet intake assistant promises "any language works", so language identification is the
 * default. The options are the languages Transcribe Streaming can identify that the team and its
 * fixture families actually speak; a deployment narrows or widens the list with
 * `TRANSCRIBE_LANGUAGE_OPTIONS`.
 */
export const DEFAULT_TRANSCRIBE_LANGUAGE_OPTIONS = ['en-US', 'en-AU', 'zh-CN', 'ko-KR', 'es-US'];

type EnvironmentVariables = Record<string, string | undefined>;

export const DEFAULT_TRANSCRIBE_REGION = 'ap-southeast-2';
/** Sydney, Melbourne and Auckland: the regions the voice privacy notice covers. */
export const ALLOWED_TRANSCRIBE_REGIONS: readonly string[] = [
  'ap-southeast-2',
  'ap-southeast-4',
  'ap-southeast-6',
];

const readTrimmed = (env: EnvironmentVariables, name: string): string | undefined => {
  const value = env[name]?.trim();
  return value ? value : undefined;
};

export const getTranscribeStreamConfiguration = (
  env: EnvironmentVariables = process.env,
): TranscribeStreamConfiguration => {
  /*
   * Only TRANSCRIBE_AWS_REGION counts. AWS_REGION in this project is the Neon object storage region
   * (us-east-2), and falling back to it would send guests' voices to the United States while the
   * privacy notice says audio is processed in Australia. Unset means Sydney; anything outside
   * Australia/New Zealand is refused until the notice says otherwise.
   */
  const region = readTrimmed(env, 'TRANSCRIBE_AWS_REGION') ?? DEFAULT_TRANSCRIBE_REGION;
  if (!ALLOWED_TRANSCRIBE_REGIONS.includes(region)) {
    throw new SpeechConfigurationError(
      `TRANSCRIBE_AWS_REGION must be an Australia/New Zealand region (${ALLOWED_TRANSCRIBE_REGIONS.join(', ')}); the privacy notice promises audio is processed there`,
    );
  }

  const accessKeyId = readTrimmed(env, 'TRANSCRIBE_AWS_ACCESS_KEY_ID');
  const secretAccessKey = readTrimmed(env, 'TRANSCRIBE_AWS_SECRET_ACCESS_KEY');
  if (Boolean(accessKeyId) !== Boolean(secretAccessKey)) {
    throw new SpeechConfigurationError(
      'TRANSCRIBE_AWS_ACCESS_KEY_ID and TRANSCRIBE_AWS_SECRET_ACCESS_KEY must be set together',
    );
  }

  /*
   * `AWS_ACCESS_KEY_ID` in this project belongs to Neon Object Storage (see `object.storage.ts`),
   * not to an AWS account. The SDK's default credential chain would silently pick those keys up
   * and every session would fail with an opaque signature error, so when Neon keys are present the
   * Transcribe keys have to be given explicitly. Without Neon keys the default chain is fine: on
   * AWS that is the task or instance role.
   */
  const usesNeonKeys = Boolean(
    readTrimmed(env, 'AWS_ENDPOINT_URL_S3') && readTrimmed(env, 'AWS_ACCESS_KEY_ID'),
  );
  if (!accessKeyId && usesNeonKeys) {
    throw new SpeechConfigurationError(
      'AWS_ACCESS_KEY_ID is the Neon Object Storage key; set TRANSCRIBE_AWS_ACCESS_KEY_ID and TRANSCRIBE_AWS_SECRET_ACCESS_KEY for Amazon Transcribe',
    );
  }

  const languageCode = readTrimmed(env, 'TRANSCRIBE_LANGUAGE_CODE');
  const configuredOptions = (env.TRANSCRIBE_LANGUAGE_OPTIONS ?? '')
    .split(',')
    .map((option) => option.trim())
    .filter((option) => option.length > 0);
  const languageOptions =
    configuredOptions.length > 0 ? configuredOptions : DEFAULT_TRANSCRIBE_LANGUAGE_OPTIONS;
  if (!languageCode && languageOptions.length < 2) {
    throw new SpeechConfigurationError(
      'TRANSCRIBE_LANGUAGE_OPTIONS needs at least two language codes when TRANSCRIBE_LANGUAGE_CODE is not set',
    );
  }

  const preferredLanguage = readTrimmed(env, 'TRANSCRIBE_PREFERRED_LANGUAGE') ?? languageOptions[0];
  if (!preferredLanguage || !languageOptions.includes(preferredLanguage)) {
    throw new SpeechConfigurationError(
      'TRANSCRIBE_PREFERRED_LANGUAGE must be one of TRANSCRIBE_LANGUAGE_OPTIONS',
    );
  }

  return {
    region,
    ...(accessKeyId && secretAccessKey ? { credentials: { accessKeyId, secretAccessKey } } : {}),
    ...(languageCode ? { languageCode } : {}),
    languageOptions,
    preferredLanguage,
    sampleRateHertz: SPEECH_SAMPLE_RATE_HERTZ,
  };
};

/**
 * Flattens one provider event into segments. Exceptions arrive on the same stream as data in the
 * Transcribe protocol, so they are turned into thrown errors here rather than leaking upwards as
 * odd-shaped events.
 */
export const mapTranscriptResultStreamEvent = (
  event: TranscriptResultStream,
): TranscriptSegment[] => {
  if (event.TranscriptEvent) {
    const results = event.TranscriptEvent.Transcript?.Results ?? [];
    return results.flatMap((result) => {
      const text = result.Alternatives?.[0]?.Transcript?.trim() ?? '';
      if (!text) {
        return [];
      }
      const segment: TranscriptSegment = { text, isPartial: result.IsPartial === true };
      if (result.ResultId) {
        segment.resultId = result.ResultId;
      }
      if (result.LanguageCode) {
        segment.languageCode = result.LanguageCode;
      }
      return [segment];
    });
  }

  const retryableFailure = event.ServiceUnavailableException ?? event.InternalFailureException;
  if (retryableFailure) {
    throw new SpeechProviderError(
      retryableFailure.message ?? 'Amazon Transcribe is temporarily unavailable',
      true,
    );
  }

  const terminalFailure =
    event.BadRequestException ?? event.LimitExceededException ?? event.ConflictException;
  if (terminalFailure) {
    throw new SpeechProviderError(
      terminalFailure.message ?? 'Amazon Transcribe rejected the audio stream',
      false,
    );
  }

  return [];
};

async function* toAudioStream(audio: AsyncIterable<Uint8Array>): AsyncIterable<AudioStream> {
  for await (const chunk of audio) {
    yield { AudioEvent: { AudioChunk: chunk } };
  }
}

const languageParameters = (
  configuration: TranscribeStreamConfiguration,
): Pick<
  ConstructorParameters<typeof StartStreamTranscriptionCommand>[0],
  'LanguageCode' | 'IdentifyLanguage' | 'LanguageOptions' | 'PreferredLanguage'
> => {
  if (configuration.languageCode) {
    return { LanguageCode: configuration.languageCode as LanguageCode };
  }
  return {
    IdentifyLanguage: true,
    LanguageOptions: configuration.languageOptions.join(','),
    PreferredLanguage: configuration.preferredLanguage as LanguageCode,
  };
};

export const createAmazonTranscribeStreamer = (
  configuration: TranscribeStreamConfiguration,
  client?: TranscribeStreamingClient,
): TranscribeStreamer => {
  const transcribeClient =
    client ??
    new TranscribeStreamingClient({
      region: configuration.region,
      ...(configuration.credentials ? { credentials: configuration.credentials } : {}),
    });

  return {
    async *transcribe(audio, { sessionId, signal }): AsyncIterable<TranscriptSegment> {
      const command = new StartStreamTranscriptionCommand({
        MediaEncoding: 'pcm',
        MediaSampleRateHertz: configuration.sampleRateHertz,
        // Stabilised partials stop the interim text from rewriting itself word by word.
        EnablePartialResultsStabilization: true,
        PartialResultsStability: 'medium',
        SessionId: sessionId,
        AudioStream: toAudioStream(audio),
        ...languageParameters(configuration),
      });

      const response = await transcribeClient.send(command, { abortSignal: signal });
      for await (const event of response.TranscriptResultStream ?? []) {
        yield* mapTranscriptResultStreamEvent(event);
      }
    },
  };
};
