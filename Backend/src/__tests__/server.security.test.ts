import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { parseTrustProxy } from '../config/trust-proxy.js';

vi.mock('../config/database.js', () => ({
  pool: { query: vi.fn(), connect: vi.fn() },
  checkDatabaseConnection: vi.fn(async () => new Date('2026-10-01T00:00:00.000Z')),
}));
vi.mock('../config/mongodb.js', () => ({
  connectToMongoDB: vi.fn(),
  checkMongoConnection: vi.fn(async () => true),
}));

// Loaded once: the app registers Mongo models, which cannot be registered twice in one process.
const { app } = await import('../server.js');

describe('server baseline', () => {
  it('answers the health check without a session', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', database: 'connected', mongo: 'connected' });
  });

  it('sends the baseline security headers and hides the framework', async () => {
    const res = await request(app).get('/api/health');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['content-security-policy']).toBe("frame-ancestors 'none'");
    expect(res.headers['x-powered-by']).toBeUndefined();
    // Local and test runs are plain HTTP, so HSTS waits for production.
    expect(res.headers['strict-transport-security']).toBeUndefined();
  });

  it('applies the TRUST_PROXY setting to the app', () => {
    expect(app.get('trust proxy')).toEqual(parseTrustProxy(process.env.TRUST_PROXY));
  });
});

describe('parseTrustProxy', () => {
  it('reads off, on, a hop count and a list of proxy addresses', () => {
    expect(parseTrustProxy(undefined)).toBe(false);
    expect(parseTrustProxy(' false ')).toBe(false);
    expect(parseTrustProxy('true')).toBe(true);
    expect(parseTrustProxy('2')).toBe(2);
    expect(parseTrustProxy('10.0.0.0/8, 172.16.0.0/12,')).toEqual(['10.0.0.0/8', '172.16.0.0/12']);
  });
});
