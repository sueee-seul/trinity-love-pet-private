import { describe, expect, it } from 'vitest';
import { bedrockMantleRegion } from '../config/mantle.js';
import {
  readAiProcessingDisclosure,
  readAssistantProcessing,
  readParentChatProcessing,
  readSpeechProcessing,
} from '../services/ai-processing-disclosure.js';

const SYDNEY_MANTLE = 'https://bedrock-mantle.ap-southeast-2.api.aws/v1';
const OHIO_MANTLE = 'https://bedrock-mantle.us-east-2.api.aws/v1';

describe('bedrockMantleRegion', () => {
  it.each([
    [SYDNEY_MANTLE, 'ap-southeast-2'],
    [OHIO_MANTLE, 'us-east-2'],
    ['http://127.0.0.1:11434/api', null],
    ['https://api.openai.com/v1', null],
    ['https://bedrock-mantle.ap-southeast-2.api.aws.evil.example/v1', null],
    ['not a url', null],
  ])('reads %s as %s', (baseUrl, region) => {
    expect(bedrockMantleRegion(baseUrl)).toBe(region);
  });
});

describe('readAssistantProcessing', () => {
  it.each([
    ['unset: the rules assistant, no model', {}, { kind: 'rules', region: null }],
    ['rules', { CONCIERGE_AI_PROVIDER: 'rules' }, { kind: 'rules', region: null }],
    [
      'anthropic: the direct API, which has no region to report',
      { CONCIERGE_AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'test-key' },
      { kind: 'anthropic', region: null },
    ],
    [
      'bedrock with no region set: Sydney, as the factory defaults',
      { CONCIERGE_AI_PROVIDER: 'bedrock' },
      { kind: 'bedrock', region: 'ap-southeast-2' },
    ],
    [
      'bedrock in a named region',
      { CONCIERGE_AI_PROVIDER: 'bedrock', CONCIERGE_BEDROCK_REGION: 'us-east-1' },
      { kind: 'bedrock', region: 'us-east-1' },
    ],
    [
      'bedrock with a region that is not a region code',
      { CONCIERGE_AI_PROVIDER: 'bedrock', CONCIERGE_BEDROCK_REGION: 'https://x.example' },
      { kind: 'bedrock', region: null },
    ],
    [
      'openai with no base URL: Bedrock Mantle in Sydney, the default endpoint',
      { CONCIERGE_AI_PROVIDER: 'openai', LLM_API_KEY: 'test-key' },
      { kind: 'bedrock', region: 'ap-southeast-2' },
    ],
    [
      'openai on Mantle in Ohio',
      { CONCIERGE_AI_PROVIDER: 'openai', LLM_API_KEY: 'test-key', LLM_BASE_URL: OHIO_MANTLE },
      { kind: 'bedrock', region: 'us-east-2' },
    ],
    [
      'openai on an endpoint that is not Bedrock',
      {
        CONCIERGE_AI_PROVIDER: 'openai',
        LLM_API_KEY: 'test-key',
        LLM_BASE_URL: 'https://api.openai.com/v1',
      },
      { kind: 'other', region: null },
    ],
  ])('%s', (_name, environment, expected) => {
    expect(readAssistantProcessing(environment)).toEqual(expected);
  });

  it('is null for a provider the server does not know, so nothing is claimed', () => {
    expect(readAssistantProcessing({ CONCIERGE_AI_PROVIDER: 'mystery' })).toBeNull();
  });
});

describe('readSpeechProcessing', () => {
  it.each([
    ['unset: the local Whisper service', {}, { kind: 'whisper', region: null }],
    [
      'whisper with its own URL',
      { SPEECH_PROVIDER: 'whisper', WHISPER_SERVICE_URL: 'http://127.0.0.1:8765' },
      { kind: 'whisper', region: null },
    ],
    [
      'transcribe with no region set: Sydney, as the provider defaults',
      { SPEECH_PROVIDER: 'transcribe' },
      { kind: 'transcribe', region: 'ap-southeast-2' },
    ],
    [
      'transcribe in Melbourne',
      { SPEECH_PROVIDER: 'transcribe', TRANSCRIBE_AWS_REGION: 'ap-southeast-4' },
      { kind: 'transcribe', region: 'ap-southeast-4' },
    ],
    [
      'transcribe in a region the provider refuses: no dictation starts',
      { SPEECH_PROVIDER: 'transcribe', TRANSCRIBE_AWS_REGION: 'us-east-2' },
      { kind: 'off', region: null },
    ],
    ['an unknown provider', { SPEECH_PROVIDER: 'cloud-magic' }, { kind: 'off', region: null }],
    [
      'whisper with a URL it cannot use',
      { WHISPER_SERVICE_URL: 'not a url' },
      { kind: 'off', region: null },
    ],
  ])('%s', (_name, environment, expected) => {
    expect(readSpeechProcessing(environment)).toEqual(expected);
  });
});

describe('readParentChatProcessing', () => {
  it.each([
    ['unset: the local model', {}, { kind: 'other', region: null }],
    [
      'Bedrock Mantle in Sydney',
      { LLM_BASE_URL: SYDNEY_MANTLE },
      {
        kind: 'bedrock',
        region: 'ap-southeast-2',
      },
    ],
    [
      'another endpoint',
      { LLM_BASE_URL: 'https://api.openai.com/v1' },
      {
        kind: 'other',
        region: null,
      },
    ],
    ['an invalid base URL', { LLM_BASE_URL: 'not a url' }, { kind: 'off', region: null }],
  ])('%s', (_name, environment, expected) => {
    expect(readParentChatProcessing(environment)).toEqual(expected);
  });
});

describe('readAiProcessingDisclosure', () => {
  it('reports the defaults when nothing is configured', () => {
    expect(readAiProcessingDisclosure({})).toEqual({
      assistant: { kind: 'rules', region: null },
      speech: { kind: 'whisper', region: null },
      parentChat: { kind: 'other', region: null },
    });
  });

  it('never carries a key, a URL or a model name to the browser', () => {
    const disclosure = readAiProcessingDisclosure({
      CONCIERGE_AI_PROVIDER: 'openai',
      LLM_API_KEY: 'secret-llm-key',
      LLM_BASE_URL: SYDNEY_MANTLE,
      CONCIERGE_OPENAI_MODEL: 'openai.gpt-oss-120b',
      SPEECH_PROVIDER: 'transcribe',
      TRANSCRIBE_AWS_ACCESS_KEY_ID: 'AKIATESTKEY',
      TRANSCRIBE_AWS_SECRET_ACCESS_KEY: 'secret-aws-key',
      ANTHROPIC_API_KEY: 'secret-anthropic-key',
    });
    const serialised = JSON.stringify(disclosure);

    expect(serialised).not.toMatch(/secret|AKIA|https?:|gpt-oss|api\.aws/);
    expect(disclosure).toEqual({
      assistant: { kind: 'bedrock', region: 'ap-southeast-2' },
      speech: { kind: 'transcribe', region: 'ap-southeast-2' },
      parentChat: { kind: 'bedrock', region: 'ap-southeast-2' },
    });
  });
});
