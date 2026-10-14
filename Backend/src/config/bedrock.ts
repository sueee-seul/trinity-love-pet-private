import { AnthropicBedrockMantle } from '@anthropic-ai/bedrock-sdk';

/**
 * One place to read the Bedrock settings every model call shares (the label reader, the update
 * writer; the concierge has its own factory with the same names). `BEDROCK_*` is read first, then
 * `CONCIERGE_BEDROCK_*`, so a server set up for the concierge alone keeps working. Inference stays in
 * Sydney by default: the privacy notice tells parents where their words and photos are processed.
 */

export const DEFAULT_BEDROCK_REGION = 'ap-southeast-2';
export const DEFAULT_BEDROCK_MODEL = 'anthropic.claude-opus-5';

type Environment = Record<string, string | undefined>;

const PREFIXES = ['BEDROCK', 'CONCIERGE_BEDROCK'] as const;

const setting = (environment: Environment, name: string): string | undefined => {
  for (const prefix of PREFIXES) {
    const value = environment[`${prefix}_${name}`]?.trim();
    if (value) return value;
  }
  return undefined;
};

export interface BedrockSettings {
  region: string;
  model: string;
  credentials:
    { apiKey: string } | { accessKey: string; secretKey: string; sessionToken: string | null };
}

/** The settings, or null when no credential is set: the caller then says the feature is off. */
export const readBedrockSettings = (
  environment: Environment = process.env,
): BedrockSettings | null => {
  const region = setting(environment, 'REGION') ?? DEFAULT_BEDROCK_REGION;
  const model = setting(environment, 'MODEL') ?? DEFAULT_BEDROCK_MODEL;
  const apiKey = setting(environment, 'API_KEY');
  if (apiKey) return { region, model, credentials: { apiKey } };
  const accessKey = setting(environment, 'ACCESS_KEY_ID');
  const secretKey = setting(environment, 'SECRET_ACCESS_KEY');
  if (accessKey && secretKey) {
    return {
      region,
      model,
      credentials: {
        accessKey,
        secretKey,
        sessionToken: setting(environment, 'SESSION_TOKEN') ?? null,
      },
    };
  }
  return null;
};

export const bedrockConfigured = (environment: Environment = process.env): boolean =>
  readBedrockSettings(environment) !== null;

/** A client for `messages.create`, or null when Bedrock is not configured. Opens no connection. */
export const createBedrockMessagesClient = (
  environment: Environment = process.env,
): { client: AnthropicBedrockMantle; model: string } | null => {
  const settings = readBedrockSettings(environment);
  if (!settings) return null;
  const client =
    'apiKey' in settings.credentials
      ? new AnthropicBedrockMantle({
          awsRegion: settings.region,
          apiKey: settings.credentials.apiKey,
        })
      : new AnthropicBedrockMantle({
          awsRegion: settings.region,
          awsAccessKey: settings.credentials.accessKey,
          awsSecretAccessKey: settings.credentials.secretKey,
          awsSessionToken: settings.credentials.sessionToken,
        });
  return { client, model: settings.model };
};
