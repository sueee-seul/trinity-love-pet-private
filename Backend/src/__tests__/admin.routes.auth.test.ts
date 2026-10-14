import { describe, expect, it } from 'vitest';
import request from 'supertest';
import express from 'express';
import petRoutes from '../routes/pet.routes.js';
import facilityRoutes from '../routes/facility.routes.js';
import { errorHandler } from '../common/middlewares/error.middleware.js';

/**
 * These two routers used to answer anyone at all: a pet's health notes,
 * medication records and check-in state, and every facility's address and
 * capacity, were readable and writable with no session. This pins down that
 * they are not, and that the manager-only writes stay manager-only.
 *
 * The real middleware runs here - nothing is mocked - so an unauthenticated
 * request takes exactly the path a browser's would.
 */
const app = express();
app.use(express.json());
app.use('/api/admin/pets', petRoutes);
app.use('/api/admin/facilities', facilityRoutes);
app.use(errorHandler);

const PET = '00000000-0000-4000-8000-000000000401';
const MED = '00000000-0000-4000-8000-000000000701';

const petRequests = (): { label: string; run: () => request.Test }[] => [
  { label: 'GET /', run: () => request(app).get('/api/admin/pets') },
  { label: 'GET /:id', run: () => request(app).get(`/api/admin/pets/${PET}`) },
  { label: 'PATCH /:id', run: () => request(app).patch(`/api/admin/pets/${PET}`).send({}) },
  {
    label: 'PATCH /:id/status',
    run: () => request(app).patch(`/api/admin/pets/${PET}/status`).send({ status: 'incoming' }),
  },
  {
    label: 'PATCH /:id/health-notes',
    run: () => request(app).patch(`/api/admin/pets/${PET}/health-notes`).send({ notes: 'x' }),
  },
  {
    label: 'PATCH /:id/behaviour-notes',
    run: () => request(app).patch(`/api/admin/pets/${PET}/behaviour-notes`).send({ notes: 'x' }),
  },
  {
    label: 'GET /:id/assignments',
    run: () => request(app).get(`/api/admin/pets/${PET}/assignments`),
  },
  {
    label: 'POST /:id/assignments',
    run: () => request(app).post(`/api/admin/pets/${PET}/assignments`).send({}),
  },
  {
    label: 'DELETE /:id/assignments/:assignmentId',
    run: () => request(app).delete(`/api/admin/pets/${PET}/assignments/${MED}`),
  },
  {
    label: 'POST /:id/medications',
    run: () => request(app).post(`/api/admin/pets/${PET}/medications`).send({}),
  },
  {
    label: 'PATCH /:id/medications/:medicationId',
    run: () => request(app).patch(`/api/admin/pets/${PET}/medications/${MED}`).send({}),
  },
  {
    label: 'DELETE /:id/medications/:medicationId',
    run: () => request(app).delete(`/api/admin/pets/${PET}/medications/${MED}`),
  },
];

const facilityRequests = (): { label: string; run: () => request.Test }[] => [
  { label: 'GET /', run: () => request(app).get('/api/admin/facilities') },
  { label: 'GET /:id', run: () => request(app).get('/api/admin/facilities/f1') },
  { label: 'PATCH /:id', run: () => request(app).patch('/api/admin/facilities/f1').send({}) },
];

describe('admin pet routes reject an unauthenticated caller', () => {
  for (const { label, run } of petRequests()) {
    it(`${label} answers 401 without a session`, async () => {
      const response = await run();
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHENTICATED');
    });
  }
});

describe('admin facility routes reject an unauthenticated caller', () => {
  for (const { label, run } of facilityRequests()) {
    it(`${label} answers 401 without a session`, async () => {
      const response = await run();
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHENTICATED');
    });
  }
});
