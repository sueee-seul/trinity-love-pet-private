import { readFileSync } from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

/**
 * The OpenAI-compatible model endpoint every model feature outside the parent chat uses: Amazon
 * Bedrock Mantle in Sydney by default, with the course's 12-hour bearer key. The same three
 * `LLM_*` variables the parent chat reads are the defaults, so one key serves everything; a feature
 * may name its own model (`CONCIERGE_OPENAI_MODEL`, `VISION_MODEL`, `UPDATE_WRITER_MODEL`).
 *
 * The key is read at call time, and a 401 re-reads `Backend/.env` once before giving up, so a new
 * key pasted into the file takes effect without a restart. Claude is not reachable from the course
 * account (its organisation policy denies the Claude models), so the defaults are the open models
 * Mantle serves in Sydney.
 */

export const DEFAULT_MANTLE_BASE_URL = 'https://bedrock-mantle.ap-southeast-2.api.aws/v1';
export const DEFAULT_CHAT_MODEL = 'openai.gpt-oss-120b';
export const DEFAULT_VISION_MODEL = 'qwen.qwen3-vl-235b-a22b-instruct';
export const DEFAULT_WRITER_MODEL = 'openai.gpt-oss-20b';

/** Keys that may change while the server runs; only these are refreshed from the file. */
const RELOADABLE_KEYS = [
  'LLM_BASE_URL',
  'LLM_MODEL',
  'LLM_API_KEY',
  'CONCIERGE_OPENAI_MODEL',
  'VISION_MODEL',
  'UPDATE_WRITER_MODEL',
] as const;

type Environment = Record<string, string | undefined>;

export interface MantleSettings {
  baseUrl: string;
  apiKey: string;
}

const clean = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

/** The endpoint and key, or null when no key is set (the feature then says it is not set up). */
export const readMantleSettings = (
  environment: Environment = process.env,
): MantleSettings | null => {
  const apiKey = clean(environment.LLM_API_KEY);
  // The local Ollama default key means "no cloud model".
  if (!apiKey || apiKey === 'ollama') return null;
  return {
    baseUrl: (clean(environment.LLM_BASE_URL) ?? DEFAULT_MANTLE_BASE_URL).replace(/\/+$/, ''),
    apiKey,
  };
};

/** A Bedrock Mantle host names its region: `bedrock-mantle.<region>.api.aws`. */
const BEDROCK_MANTLE_HOST = /^bedrock-mantle\.([a-z0-9-]+)\.api\.aws$/;

/**
 * The AWS region of a Bedrock Mantle endpoint, or null for any other endpoint (a local model, or
 * another provider). The privacy notice names this region, so only the host decides it.
 */
export const bedrockMantleRegion = (baseUrl: string): string | null => {
  let host: string;
  try {
    host = new URL(baseUrl).hostname;
  } catch {
    return null;
  }
  return BEDROCK_MANTLE_HOST.exec(host)?.[1] ?? null;
};

export const mantleConfigured = (environment: Environment = process.env): boolean =>
  readMantleSettings(environment) !== null;

/** The model a feature uses: its own variable, else the shared chat model, else the default. */
export const readModelName = (
  feature: 'chat' | 'vision' | 'writer',
  environment: Environment = process.env,
): string => {
  if (feature === 'vision') return clean(environment.VISION_MODEL) ?? DEFAULT_VISION_MODEL;
  if (feature === 'writer') return clean(environment.UPDATE_WRITER_MODEL) ?? DEFAULT_WRITER_MODEL;
  return (
    clean(environment.CONCIERGE_OPENAI_MODEL) ?? clean(environment.LLM_MODEL) ?? DEFAULT_CHAT_MODEL
  );
};

/**
 * Re-reads the reloadable keys from `Backend/.env`. Called after a 401, so a rotated key in the
 * file is picked up by the next call. Returns true when any value changed.
 */
export const reloadModelKeys = (
  envPath: string = path.resolve(process.cwd(), '.env'),
  environment: Environment = process.env,
): boolean => {
  let parsed: Record<string, string>;
  try {
    parsed = dotenv.parse(readFileSync(envPath, 'utf8'));
  } catch {
    return false;
  }
  let changed = false;
  for (const key of RELOADABLE_KEYS) {
    const next = parsed[key];
    if (next !== undefined && next !== environment[key]) {
      environment[key] = next;
      changed = true;
    }
  }
  return changed;
};

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ChatContentPart[] | null;
  tool_calls?: ChatToolCall[];
  tool_call_id?: string;
}

export type ChatContentPart =
  { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };

export interface ChatToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface ChatTool {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  tools?: ChatTool[];
  tool_choice?: 'auto' | 'none';
  max_tokens?: number;
  temperature?: number;
}

export interface ChatCompletionChoice {
  finish_reason: string | null;
  message: { role: 'assistant'; content: string | null; tool_calls?: ChatToolCall[] };
}

export interface ChatCompletionResponse {
  choices: ChatCompletionChoice[];
}

export class MantleCallError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = 'MantleCallError';
  }
}

export interface MantleClient {
  complete(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
}

const CALL_TIMEOUT_MS = 60_000;

/**
 * One chat completion through `fetch`. The key is read on every call; a 401 refreshes the keys
 * from the file and tries once more. Errors carry the status and nothing from the request body,
 * which holds the guest's words.
 */
export class FetchMantleClient implements MantleClient {
  constructor(
    private readonly environment: Environment = process.env,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly reload: () => boolean = (): boolean => reloadModelKeys(),
  ) {}

  async complete(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const first = await this.send(request);
    if (first.status !== 401 || !this.reload()) return this.parse(first);
    return this.parse(await this.send(request));
  }

  private async send(request: ChatCompletionRequest): Promise<Response> {
    const settings = readMantleSettings(this.environment);
    if (!settings) throw new MantleCallError('No model key is set', null);
    try {
      return await this.fetchImpl(`${settings.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${settings.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
      });
    } catch (error: unknown) {
      throw new MantleCallError(error instanceof Error ? error.name : 'fetch failed', null);
    }
  }

  private async parse(response: Response): Promise<ChatCompletionResponse> {
    if (!response.ok) {
      throw new MantleCallError(`The model endpoint answered ${response.status}`, response.status);
    }
    const body = (await response.json()) as Partial<ChatCompletionResponse>;
    if (!Array.isArray(body.choices) || body.choices.length === 0) {
      throw new MantleCallError('The model endpoint returned no choices', response.status);
    }
    return body as ChatCompletionResponse;
  }
}

let sharedClient: MantleClient | null = null;

/** The process-wide client, or null when no key is set. */
export const getMantleClient = (environment: Environment = process.env): MantleClient | null => {
  if (!mantleConfigured(environment)) return null;
  sharedClient ??= new FetchMantleClient(environment);
  return sharedClient;
};

/** The text of a reply, with the model's reasoning field (if any) left out. */
export const textOfChoice = (choice: ChatCompletionChoice): string =>
  typeof choice.message.content === 'string' ? choice.message.content.trim() : '';
