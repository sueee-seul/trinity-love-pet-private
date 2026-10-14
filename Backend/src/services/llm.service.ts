import { createOpenAI } from '@ai-sdk/openai';
import { createOllama } from 'ollama-ai-provider-v2';
import { z } from 'zod';

const DEFAULT_LLM_BASE_URL = 'http://127.0.0.1:11434/api';
export const DEFAULT_LLM_MODEL = 'qwen2.5-coder:14b';
const DEFAULT_LLM_API_KEY = 'ollama';

const llmEnvironmentSchema = z.object({
  LLM_BASE_URL: z.string().trim().url().default(DEFAULT_LLM_BASE_URL),
  LLM_MODEL: z.string().trim().min(1).default(DEFAULT_LLM_MODEL),
  LLM_API_KEY: z.string().trim().default(DEFAULT_LLM_API_KEY),
});

type LlmEnvironment = Readonly<Record<string, string | undefined>>;
type BackendToolModel =
  | ReturnType<ReturnType<typeof createOllama>['chat']>
  | ReturnType<ReturnType<typeof createOpenAI>['chat']>;

const parseLlmEnvironment = (environment: LlmEnvironment): z.infer<typeof llmEnvironmentSchema> => {
  const parsed = llmEnvironmentSchema.safeParse(environment);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'configuration'}: ${issue.message}`)
      .join('; ');

    throw new Error(`Invalid Backend LLM configuration: ${issues}`);
  }

  return parsed.data;
};

/**
 * The parent chat's model endpoint, read the same way the model is built, so the privacy
 * disclosure names the endpoint actually in use. Throws when the configuration is invalid.
 */
export const readLlmBaseUrl = (environment: LlmEnvironment = process.env): string =>
  parseLlmEnvironment(environment).LLM_BASE_URL;

export const createLocalOllamaToolModel = (
  environment: LlmEnvironment = process.env,
): ReturnType<ReturnType<typeof createOllama>['chat']> => {
  const parsed = parseLlmEnvironment(environment);
  const provider = createOllama({
    baseURL: parsed.LLM_BASE_URL,
  });
  return provider.chat(parsed.LLM_MODEL);
};

export const createOpenAIStandardToolModel = (
  environment: LlmEnvironment = process.env,
): ReturnType<ReturnType<typeof createOpenAI>['chat']> => {
  const parsed = parseLlmEnvironment(environment);
  const provider = createOpenAI({
    baseURL: parsed.LLM_BASE_URL,
    apiKey: parsed.LLM_API_KEY,
  });
  return provider.chat(parsed.LLM_MODEL);
};

const isLocalOllamaUrl = (baseUrl: string): boolean =>
  baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1') || baseUrl.includes('11434');

/**
 * Creates the Backend-owned Chat Completions model used by tool loops.
 * Dynamically routes to the native Ollama provider or OpenAI standard provider
 * based on the LLM_BASE_URL.
 */
export const createToolModel = (environment: LlmEnvironment = process.env): BackendToolModel => {
  const parsed = parseLlmEnvironment(environment);

  if (isLocalOllamaUrl(parsed.LLM_BASE_URL)) {
    return createLocalOllamaToolModel(environment);
  }

  return createOpenAIStandardToolModel(environment);
};

/**
 * Whether a custom `temperature` can be passed to `llmProvider`/`createToolModel()`.
 * OpenAI's reasoning-tier models (o1/o3/gpt-5.x reasoning variants, etc.) reject a
 * custom temperature outright. The AI SDK silently drops it and logs a warning
 * rather than failing the request, but callers should not rely on that: this lets
 * a caller omit the option instead of passing one that's quietly ignored.
 * Approximated the same way createToolModel() picks a provider: local Ollama
 * supports it, everything routed to OpenAI is assumed reasoning-tier and does not.
 */
export const supportsCustomTemperature = (environment: LlmEnvironment = process.env): boolean => {
  const parsed = parseLlmEnvironment(environment);
  return isLocalOllamaUrl(parsed.LLM_BASE_URL);
};

export const llmProvider = createToolModel();
