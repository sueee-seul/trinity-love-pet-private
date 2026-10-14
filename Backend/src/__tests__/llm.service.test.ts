import { describe, expect, it } from 'vitest';
import {
  createLocalOllamaToolModel,
  createOpenAIStandardToolModel,
  createToolModel,
  supportsCustomTemperature,
} from '../services/llm.service.js';

describe('Backend LLM model boundary', () => {
  it('creates the configured native Ollama model from Backend-owned environment values', () => {
    const model = createLocalOllamaToolModel({
      LLM_BASE_URL: 'http://localhost:11434/api',
      LLM_MODEL: 'qwen2.5-coder:14b',
    });

    expect(model.modelId).toBe('qwen2.5-coder:14b');
    expect(model.provider).toContain('ollama');
    expect(typeof model.doGenerate).toBe('function');
  });

  it('creates the configured OpenAI-compatible chat model from Backend-owned values', () => {
    const model = createOpenAIStandardToolModel({
      LLM_BASE_URL: 'https://example.test/v1',
      LLM_MODEL: 'provider-model',
      LLM_API_KEY: 'test-key',
    });

    expect(model.modelId).toBe('provider-model');
    expect(model.provider).toContain('openai');
    expect(typeof model.doGenerate).toBe('function');
  });

  it('selects the native Ollama model for the local configured endpoint', () => {
    const model = createToolModel({
      LLM_BASE_URL: 'http://127.0.0.1:11434/api',
      LLM_MODEL: 'qwen2.5-coder:14b',
    });

    expect(model.modelId).toBe('qwen2.5-coder:14b');
    expect(model.provider).toContain('ollama');
    expect(typeof model.doGenerate).toBe('function');
  });
});

describe('supportsCustomTemperature', () => {
  it('is true for the local Ollama endpoint', () => {
    expect(supportsCustomTemperature({ LLM_BASE_URL: 'http://127.0.0.1:11434/api' })).toBe(true);
  });

  it('is false once routed to OpenAI, because reasoning-tier models reject a custom temperature', () => {
    expect(
      supportsCustomTemperature({
        LLM_BASE_URL: 'https://api.openai.com/v1',
        LLM_API_KEY: 'test-key',
      }),
    ).toBe(false);
  });
});
