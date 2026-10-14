import request from 'supertest';
import { describe, expect, it } from 'vitest';

// The vet's stay report link is public: the server must mount it ahead of the signed-in task
// routes, or every link answers "Authentication required".

const { app } = await import('../server.js');

describe('the public stay report link', () => {
  it('reaches the share routes without a sign-in', async () => {
    const response = await request(app).get('/api/share/stay-report/this-token-is-not-real-at-all');

    // A forged link gets the share page's own answer, never the sign-in wall.
    expect(response.status).not.toBe(401);
    expect(response.status).toBe(410);
  });
});
