import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { googleClientConfig } from '../controllers/auth.session.controller.js';

interface CapturedResponse {
  statusCode: number;
  body: unknown;
}

const callConfig = (): CapturedResponse => {
  const captured: CapturedResponse = { statusCode: 0, body: null };
  const res = {
    status: (code: number): Response => {
      captured.statusCode = code;
      return res as unknown as Response;
    },
    json: (body: unknown): Response => {
      captured.body = body;
      return res as unknown as Response;
    },
  };
  googleClientConfig({} as Request, res as unknown as Response);
  return captured;
};

describe('GET /api/auth/google/config', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reports Google sign-in as not configured for a placeholder client ID', () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', 'the_client_id_from_google');

    const response = callConfig();

    // A normal answer, so the browser console stays clean; the page shows email sign-in only.
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      code: 200,
      msg: 'Google sign-in is not configured',
      data: { clientId: null },
    });
  });

  it('reports Google sign-in as not configured when the client ID is empty', () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', '   ');

    expect(callConfig().body).toMatchObject({ data: { clientId: null } });
  });

  it('returns a real Google client ID', () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', '1234-abc.apps.googleusercontent.com');

    const response = callConfig();

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      data: { clientId: '1234-abc.apps.googleusercontent.com' },
    });
  });
});
