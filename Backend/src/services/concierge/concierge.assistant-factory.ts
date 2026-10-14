import Anthropic from '@anthropic-ai/sdk';
import { AnthropicBedrockMantle } from '@anthropic-ai/bedrock-sdk';
import { AppError } from '../../common/middlewares/error.middleware.js';
import { getMantleClient, readModelName } from '../../config/mantle.js';
import type { ConciergeAssistant } from './concierge.assistant.js';
import { ClaudeConciergeAssistant } from './concierge.claude-assistant.js';
import { OpenAiConciergeAssistant } from './concierge.openai-assistant.js';
import { RulesConciergeAssistant } from './concierge.rules-assistant.js';

/**
 * Chooses the concierge assistant from configuration.
 *
 * `CONCIERGE_AI_PROVIDER=rules` (the default) needs nothing. `anthropic` is Claude on the owner's
 * own Anthropic account (`ANTHROPIC_API_KEY`, plus `ANTHROPIC_WORKSPACE_ID` when the key is not
 * scoped to one workspace). `bedrock` needs its own credentials: the `AWS_*` variables in this
 * project belong to Neon object storage, and the Bedrock SDK would otherwise pick them up and fail
 * with a confusing signature error. A half-configured provider is a configuration error, never a
 * silent switch to rules.
 *
 * Bedrock region and model default to Sydney and Claude Opus 5. Keep inference in Australia or New
 * Zealand (an `au.` inference profile or the Sydney/Auckland regional endpoint, not global
 * routing) - the privacy notice tells guests where their words are processed. The Anthropic API
 * has no regional endpoint; the privacy notice must say so when that provider is live.
 */

type EnvironmentVariables = Record<string, string | undefined>;

const DEFAULT_BEDROCK_REGION = 'ap-southeast-2';
const DEFAULT_BEDROCK_MODEL = 'anthropic.claude-opus-5';
const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-5-5';

/** The Claude model the booking page uses, for the chat and the details reader alike. */
export const conciergeAnthropicModel = (environment: EnvironmentVariables): string =>
  environment.CONCIERGE_ANTHROPIC_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL;
/** A key without a workspace scope must name the workspace on every request. */
const WORKSPACE_HEADER = 'anthropic-workspace-id';
const EFFORT_LEVELS = ['low', 'medium', 'high'] as const;
type Effort = (typeof EFFORT_LEVELS)[number];

const notConfigured = (detail: string): AppError =>
  new AppError(
    `The booking assistant is not configured correctly: ${detail}`,
    'CONCIERGE_AI_NOT_CONFIGURED',
    503,
  );

const readEffort = (value: string | undefined): Effort => {
  if (value === undefined) return 'low';
  if ((EFFORT_LEVELS as readonly string[]).includes(value)) return value as Effort;
  throw notConfigured(`CONCIERGE_BEDROCK_EFFORT must be one of ${EFFORT_LEVELS.join(', ')}`);
};

/** The configured provider name, unchecked; the factory and the privacy disclosure both read it. */
export const readConciergeProviderName = (environment: EnvironmentVariables): string =>
  environment.CONCIERGE_AI_PROVIDER ?? 'rules';

/** The AWS region the Bedrock client calls, as the privacy disclosure also reports it. */
export const readBedrockRegion = (environment: EnvironmentVariables): string =>
  environment.CONCIERGE_BEDROCK_REGION ?? DEFAULT_BEDROCK_REGION;

const createBedrockClient = (environment: EnvironmentVariables): AnthropicBedrockMantle => {
  const region = readBedrockRegion(environment);
  const apiKey = environment.CONCIERGE_BEDROCK_API_KEY;
  if (apiKey) {
    return new AnthropicBedrockMantle({ awsRegion: region, apiKey });
  }
  const accessKey = environment.CONCIERGE_BEDROCK_ACCESS_KEY_ID;
  const secretKey = environment.CONCIERGE_BEDROCK_SECRET_ACCESS_KEY;
  if (!accessKey || !secretKey) {
    throw notConfigured(
      'set CONCIERGE_BEDROCK_API_KEY, or both CONCIERGE_BEDROCK_ACCESS_KEY_ID and CONCIERGE_BEDROCK_SECRET_ACCESS_KEY',
    );
  }
  return new AnthropicBedrockMantle({
    awsRegion: region,
    awsAccessKey: accessKey,
    awsSecretAccessKey: secretKey,
    awsSessionToken: environment.CONCIERGE_BEDROCK_SESSION_TOKEN ?? null,
  });
};

export const createAnthropicClient = (environment: EnvironmentVariables): Anthropic => {
  const apiKey = environment.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw notConfigured('set ANTHROPIC_API_KEY');
  const workspaceId = environment.ANTHROPIC_WORKSPACE_ID?.trim();
  return new Anthropic({
    apiKey,
    ...(workspaceId ? { defaultHeaders: { [WORKSPACE_HEADER]: workspaceId } } : {}),
  });
};

let cachedAssistant: ConciergeAssistant | null = null;

export const createConciergeAssistant = (
  environment: EnvironmentVariables = process.env,
): ConciergeAssistant => {
  const provider = readConciergeProviderName(environment);
  if (provider === 'rules') {
    return new RulesConciergeAssistant();
  }
  if (provider === 'openai') {
    // GPT OSS 120B on Bedrock Mantle in Sydney by default (config/mantle.ts); the course's key
    // in LLM_API_KEY, the model in CONCIERGE_OPENAI_MODEL or LLM_MODEL.
    const client = getMantleClient(environment);
    if (!client) {
      throw notConfigured('set LLM_API_KEY (and LLM_BASE_URL) for the OpenAI-compatible endpoint');
    }
    return new OpenAiConciergeAssistant({
      client,
      model: readModelName('chat', environment),
      log: (message, detail): void => console.error(message, detail),
    });
  }
  if (provider === 'anthropic') {
    return new ClaudeConciergeAssistant({
      client: createAnthropicClient(environment),
      model: conciergeAnthropicModel(environment),
      effort: readEffort(environment.CONCIERGE_ANTHROPIC_EFFORT),
      log: (message, detail): void => console.error(message, detail),
    });
  }
  if (provider === 'bedrock') {
    return new ClaudeConciergeAssistant({
      client: createBedrockClient(environment),
      model: environment.CONCIERGE_BEDROCK_MODEL ?? DEFAULT_BEDROCK_MODEL,
      effort: readEffort(environment.CONCIERGE_BEDROCK_EFFORT),
      log: (message, detail): void => console.error(message, detail),
    });
  }
  throw notConfigured('CONCIERGE_AI_PROVIDER must be "rules", "openai", "anthropic" or "bedrock"');
};

/** One assistant per process; the Bedrock client keeps its HTTP connections warm. */
export const getConciergeAssistant = (): ConciergeAssistant => {
  cachedAssistant ??= createConciergeAssistant();
  return cachedAssistant;
};
