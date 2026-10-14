import request from 'supertest';
import express from 'express';
import { describe, expect, it, vi } from 'vitest';
import { generateObject } from 'ai';
import feedbackRoutes from '../routes/feedback.routes.js';

vi.mock('../config/database.js', () => ({ pool: { query: vi.fn(), connect: vi.fn() } }));
vi.mock('ai', () => ({ generateObject: vi.fn() }));

const app = express();
app.use(express.json());
app.use('/api/feedback', feedbackRoutes);

describe('POST /api/feedback/generate-insights', () => {
  it('refuses a visitor without a session before calling the model', async () => {
    const res = await request(app)
      .post('/api/feedback/generate-insights')
      .send({
        rating_details: { Professional: 5, Service: 5, Communication: 5, Safety: 5, Cost: 5 },
        raw_answer: 'Lovely stay',
      });

    expect(res.status).toBe(401);
    expect(generateObject).not.toHaveBeenCalled();
  });
});
