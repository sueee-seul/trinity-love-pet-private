import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import express, { type NextFunction, type Request, type Response } from 'express';
import { errorHandler } from '../common/middlewares/error.middleware.js';
import parentProfileRoutes from '../routes/parent.profile.routes.js';
import {
  addContactForOwner,
  contactsForOwner,
  updateContactForOwner,
} from '../services/account-contacts.service.js';

const { user } = vi.hoisted(() => ({
  user: {
    id: '00000000-0000-4000-8000-000000000101',
    email: 'ava@example.com',
    name: 'Ava Mitchell',
    is_employee: false,
    is_pet_owner: true,
    employee_role: null,
    isUsingTemporaryPassword: false,
  },
}));

vi.mock('../common/middlewares/auth.middleware.js', () => ({
  requirePetParent: (req: Request, _res: Response, next: NextFunction): void => {
    req.user = user;
    next();
  },
}));
vi.mock('../config/database.js', () => ({ pool: { query: vi.fn(), connect: vi.fn() } }));
vi.mock('../services/account-contacts.service.js', () => ({
  contactsForOwner: vi.fn(async () => []),
  addContactForOwner: vi.fn(async (_owner: string, input: Record<string, unknown>) => ({
    id: '00000000-0000-4000-8000-000000000901',
    ...input,
    phone: input.phone ?? null,
    relationship: input.relationship ?? null,
    informedAt: input.informed ? '2026-12-01T00:00:00.000Z' : null,
    createdAt: '2026-12-01T00:00:00.000Z',
  })),
  updateContactForOwner: vi.fn(async () => ({ id: 'c1', informedAt: '2026-12-02T00:00:00.000Z' })),
  removeContactForOwner: vi.fn(async () => undefined),
}));

const app = express();
app.use(express.json());
app.use('/api/parent/profile', parentProfileRoutes);
app.use(errorHandler);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('contacts', () => {
  it('lists, adds and updates the signed-in owner’s contacts, keeping the IPP 3A confirmation', async () => {
    expect((await request(app).get('/api/parent/profile/contacts')).status).toBe(200);
    expect(contactsForOwner).toHaveBeenCalledWith(user.id);

    const created = await request(app).post('/api/parent/profile/contacts').send({
      role: 'emergency',
      name: 'Tom Mitchell',
      phone: '021 555 0101',
      relationship: 'partner',
      informed: true,
    });
    expect(created.status).toBe(201);
    expect(created.body.contact.informedAt).toBeTruthy();
    expect(addContactForOwner).toHaveBeenCalledWith(
      user.id,
      expect.objectContaining({ role: 'emergency', name: 'Tom Mitchell', informed: true }),
    );

    const patched = await request(app)
      .patch('/api/parent/profile/contacts/00000000-0000-4000-8000-000000000901')
      .send({ informed: true });
    expect(patched.status).toBe(200);
    expect(updateContactForOwner).toHaveBeenCalledWith(
      user.id,
      '00000000-0000-4000-8000-000000000901',
      { informed: true },
    );
  });

  it('refuses an emergency contact without a phone, an unknown role and a pick-up role', async () => {
    const noPhone = await request(app)
      .post('/api/parent/profile/contacts')
      .send({ role: 'emergency', name: 'Jo' });
    expect(noPhone.status).toBe(400);
    const badRole = await request(app)
      .post('/api/parent/profile/contacts')
      .send({ role: 'vet', name: 'Jo' });
    expect(badRole.status).toBe(400);
    const pickUp = await request(app)
      .post('/api/parent/profile/contacts')
      .send({ role: 'pickup', name: 'Tom Mitchell', phone: '021 555 0101' });
    expect(pickUp.status).toBe(400);
    expect(addContactForOwner).not.toHaveBeenCalled();
  });
});
