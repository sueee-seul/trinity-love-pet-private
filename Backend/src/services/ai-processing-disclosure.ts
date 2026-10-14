import {
  bedrockMantleRegion,
  DEFAULT_MANTLE_BASE_URL,
  readMantleSettings,
} from '../config/mantle.js';
import type { AiProcessingDisclosure } from '../contracts/concierge.contract.js';
import {
  readBedrockRegion,
  readConciergeProviderName,
} from './concierge/concierge.assistant-factory.js';
import { readLlmBaseUrl } from './llm.service.js';
import { getSpeechProviderName } from './speech.provider.js';
import { SpeechConfigurationError } from './speech.streamer.js';
import { getTranscribeStreamConfiguration } from './speech.transcribe.stream.js';
import { getWhisperServiceUrl } from './speech.whisper.client.js';

/**
 * Where guests' words are processed, read from the same settings and defaults the assistant
 * factory, the speech provider and the parent chat model use, so the privacy notice can never
 * drift from the configuration (Privacy Act 2020 IPP 3, Fair Trading Act s 13).
 *
 * The result goes to the public status endpoint, so it holds provider kinds and region codes only.
 * A region is passed on only when it has the shape of an AWS region code; anything else becomes
 * null rather than echoing an arbitrary environment value to the browser.
 */

type EnvironmentVariables = Record<string, string | undefined>;

const AWS_REGION_CODE = /^[a-z]{2}(?:-[a-z]+)+-\d{1,2}$/;

const safeRegion = (region: string | null | undefined): string | null => {
  const trimmed = region?.trim();
  return trimmed && AWS_REGION_CODE.test(trimmed) ? trimmed : null;
};

/**
 * The `openai` provider calls whatever OpenAI-compatible endpoint `LLM_BASE_URL` names (Bedrock
 * Mantle in Sydney by default). Only a Bedrock Mantle host is reported as Bedrock. Without a key the
 * assistant cannot start and sends nothing, so the default endpoint is reported.
 */
const openAiCompatibleAssistant = (
  environment: EnvironmentVariables,
): AiProcessingDisclosure['assistant'] => {
  const baseUrl = readMantleSettings(environment)?.baseUrl ?? DEFAULT_MANTLE_BASE_URL;
  const region = bedrockMantleRegion(baseUrl);
  return region === null
    ? { kind: 'other', region: null }
    : { kind: 'bedrock', region: safeRegion(region) };
};

export const readAssistantProcessing = (
  environment: EnvironmentVariables,
): AiProcessingDisclosure['assistant'] => {
  const provider = readConciergeProviderName(environment);
  if (provider === 'rules') return { kind: 'rules', region: null };
  // The Anthropic API has no regional endpoint; requests are served in the United States.
  if (provider === 'anthropic') return { kind: 'anthropic', region: null };
  if (provider === 'bedrock') {
    return { kind: 'bedrock', region: safeRegion(readBedrockRegion(environment)) };
  }
  if (provider === 'openai') return openAiCompatibleAssistant(environment);
  return null;
};

/** A speech setting the provider would refuse means no dictation starts, so no audio goes anywhere. */
export const readSpeechProcessing = (
  environment: EnvironmentVariables,
): AiProcessingDisclosure['speech'] => {
  try {
    if (getSpeechProviderName(environment) === 'transcribe') {
      const { region } = getTranscribeStreamConfiguration(environment);
      return { kind: 'transcribe', region: safeRegion(region) };
    }
    getWhisperServiceUrl(environment);
    return { kind: 'whisper', region: null };
  } catch (error: unknown) {
    if (error instanceof SpeechConfigurationError) return { kind: 'off', region: null };
    throw error;
  }
};

export const readParentChatProcessing = (
  environment: EnvironmentVariables,
): AiProcessingDisclosure['parentChat'] => {
  let baseUrl: string;
  try {
    baseUrl = readLlmBaseUrl(environment);
  } catch {
    // An invalid LLM configuration stops the parent chat model from being built at all.
    return { kind: 'off', region: null };
  }
  const region = bedrockMantleRegion(baseUrl);
  return region === null
    ? { kind: 'other', region: null }
    : { kind: 'bedrock', region: safeRegion(region) };
};

export const readAiProcessingDisclosure = (
  environment: EnvironmentVariables = process.env,
): AiProcessingDisclosure => ({
  assistant: readAssistantProcessing(environment),
  speech: readSpeechProcessing(environment),
  parentChat: readParentChatProcessing(environment),
});
