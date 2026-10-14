import { describe, expect, it } from 'vitest';
import { AppError } from '../common/middlewares/error.middleware.js';
import { createConciergeAssistant } from '../services/concierge/concierge.assistant-factory.js';

const notConfigured = (environment: Record<string, string | undefined>): AppError => {
  try {
    createConciergeAssistant(environment);
  } catch (error: unknown) {
    if (error instanceof AppError) return error;
    throw error;
  }
  throw new Error('Expected the factory to refuse this configuration');
};

describe('createConciergeAssistant', () => {
  it('defaults to the rules assistant', () => {
    expect(createConciergeAssistant({}).mode).toBe('rules');
  });

  it('runs Claude on the Anthropic API when a key is set', () => {
    const assistant = createConciergeAssistant({
      CONCIERGE_AI_PROVIDER: 'anthropic',
      ANTHROPIC_API_KEY: 'test-key',
      ANTHROPIC_WORKSPACE_ID: 'wrkspc_test',
    });
    expect(assistant.mode).toBe('claude');
  });

  it('refuses the anthropic provider without a key instead of falling back to rules', () => {
    const error = notConfigured({ CONCIERGE_AI_PROVIDER: 'anthropic' });
    expect(error.code).toBe('CONCIERGE_AI_NOT_CONFIGURED');
    expect(error.statusCode).toBe(503);
    expect(error.message).toContain('ANTHROPIC_API_KEY');
  });

  it('refuses an effort level outside low, medium and high', () => {
    const error = notConfigured({
      CONCIERGE_AI_PROVIDER: 'anthropic',
      ANTHROPIC_API_KEY: 'test-key',
      CONCIERGE_ANTHROPIC_EFFORT: 'max',
    });
    expect(error.code).toBe('CONCIERGE_AI_NOT_CONFIGURED');
  });

  it('refuses an unknown provider', () => {
    expect(notConfigured({ CONCIERGE_AI_PROVIDER: 'gemini' }).message).toContain('anthropic');
  });
});
