import { z } from 'zod';
import { SpeechConfigurationError, SpeechProviderError } from './speech.streamer.js';

/**
 * HTTP client for the local Whisper service in `SpeechService/` (see its README).
 *
 * One call is one utterance: raw 16 kHz mono PCM16 in, text and the detected language out. The
 * service runs next to the Backend, so a refused connection means it is not started, which is
 * reported as a retryable provider error rather than a configuration error.
 */

export const DEFAULT_WHISPER_SERVICE_URL = 'http://127.0.0.1:8765';
/** A GPU answers in under a second and a CPU in a few; past this the service is stuck. */
export const WHISPER_REQUEST_TIMEOUT_MS = 15_000;
const TRANSCRIBE_PATH = '/transcribe';
const FIRST_SERVER_ERROR_STATUS = 500;

export interface WhisperTranscription {
  text: string;
  /** Whisper's language code, for example `en` or `zh`. */
  language: string;
}

export interface WhisperServiceClient {
  transcribe(pcm: Uint8Array<ArrayBuffer>, signal: AbortSignal): Promise<WhisperTranscription>;
}

export interface WhisperServiceClientOptions {
  baseUrl: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

const whisperResponseSchema = z.object({
  text: z.string(),
  language: z.string(),
});

type EnvironmentVariables = Record<string, string | undefined>;

export const getWhisperServiceUrl = (env: EnvironmentVariables = process.env): string => {
  const configured = env.WHISPER_SERVICE_URL?.trim() || DEFAULT_WHISPER_SERVICE_URL;
  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new SpeechConfigurationError('WHISPER_SERVICE_URL must be an absolute http(s) URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new SpeechConfigurationError('WHISPER_SERVICE_URL must be an absolute http(s) URL');
  }
  return url.origin;
};

const describeStatus = async (response: Response): Promise<string> => {
  // The body only enriches the message; the status alone is still reported if it cannot be read.
  const body = await response.text().catch(() => '');
  return `Whisper service answered ${response.status}${body ? `: ${body.slice(0, 200)}` : ''}`;
};

export const createWhisperServiceClient = ({
  baseUrl,
  timeoutMs = WHISPER_REQUEST_TIMEOUT_MS,
  fetchImpl = fetch,
}: WhisperServiceClientOptions): WhisperServiceClient => ({
  async transcribe(pcm, signal): Promise<WhisperTranscription> {
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    let response: Response;
    try {
      response = await fetchImpl(`${baseUrl}${TRANSCRIBE_PATH}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: pcm,
        signal: AbortSignal.any([signal, timeoutSignal]),
      });
    } catch (error: unknown) {
      // The session was closed: the caller already stopped listening, keep its error as is.
      if (signal.aborted) {
        throw error;
      }
      if (timeoutSignal.aborted) {
        throw new SpeechProviderError(
          `Whisper service did not answer within ${timeoutMs} ms`,
          true,
        );
      }
      const reason = error instanceof Error ? error.message : String(error);
      throw new SpeechProviderError(
        `Whisper service is not reachable at ${baseUrl}: ${reason}`,
        true,
      );
    }

    if (!response.ok) {
      throw new SpeechProviderError(
        await describeStatus(response),
        response.status >= FIRST_SERVER_ERROR_STATUS,
      );
    }

    // Invalid JSON becomes `null`, which the schema rejects with the error below.
    const parsed = whisperResponseSchema.safeParse(await response.json().catch(() => null));
    if (!parsed.success) {
      throw new SpeechProviderError('Whisper service returned an unexpected response', false);
    }
    return { text: parsed.data.text.trim(), language: parsed.data.language };
  },
});
