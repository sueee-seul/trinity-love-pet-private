import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  OTHER_OWNER,
  OWNER,
  MANAGER,
  STAFF,
  cookieFor,
  findTestUser,
  useTestSessionSecret,
} from './fixtures/notification.routes.fixtures.js';

// Route, controller, service and repository run for real; only the database is scripted, so each
// test can see which owner every statement was scoped to.

const { poolQuery } = vi.hoisted(() => ({ poolQuery: vi.fn() }));
vi.mock('../config/database.js', () => ({ pool: { query: poolQuery, connect: vi.fn() } }));
vi.mock('../repositories/auth.repository.js', () => ({
  createPetParentAccount: vi.fn(),
  createGooglePetParentAccount: vi.fn(),
  findUserByCredentials: vi.fn(),
  findUserByEmail: vi.fn(),
  findUserById: vi.fn((id: string) => findTestUser(id)),
  findUserByUsername: vi.fn(),
}));

import { errorHandler } from '../common/middlewares/error.middleware.js';
import { PARENT_BOOKING_NOTIFICATION_KINDS } from '../contracts/booking.notification.contract.js';
import notificationRoutes from '../routes/petparent.notifications.routes.js';

const URL = '/api/petparent/notifications';
const NOTICE_ID = '00000000-0000-4000-8000-000000000901';
const CREATED_AT = new Date('2026-10-01T02:01:00.123Z');

const createApp = (): express.Express => {
  const app = express();
  app.use(express.json());
  app.use(URL, notificationRoutes);
  app.use(errorHandler);
  return app;
};

const NOTICE_ROW = {
  id: NOTICE_ID,
  kind: 'booking_refused',
  body: "We can't take Max on 12 to 15 Oct 2026. Reason: Full.",
  created_at: CREATED_AT,
  read_at: null,
};

const statement = (call: number): { sql: string; params: unknown[] } => {
  const [sql, params] = poolQuery.mock.calls[call] ?? [];
  return { sql: String(sql), params: Array.isArray(params) ? params : [] };
};

beforeEach(() => {
  useTestSessionSecret();
  vi.clearAllMocks();
});

describe('GET /api/petparent/notifications', () => {
  it("lists the signed-in parent's notices, newest first, with the unread count", async () => {
    poolQuery.mockImplementation(async (sql: string) =>
      sql.includes('COUNT(*)') ? { rows: [{ unread_count: 3 }] } : { rows: [NOTICE_ROW] },
    );

    const response = await request(createApp())
      .get(`${URL}?limit=5`)
      .set('Cookie', await cookieFor(OWNER));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      items: [
        {
          id: NOTICE_ID,
          kind: 'booking_refused',
          title: 'Not accepted',
          body: NOTICE_ROW.body,
          // What the sentence says, for pages in another language.
          facts: {
            template: 'refused',
            pets: ['Max'],
            dates: { start: '2026-10-12', end: '2026-10-15' },
            reason: 'Full.',
          },
          createdAt: CREATED_AT.toISOString(),
          readAt: null,
        },
      ],
      unreadCount: 3,
    });
    const list = statement(0);
    expect(list.sql).toContain('pon.pet_owners_uuid = $1::uuid');
    expect(list.sql).toMatch(/ORDER BY n\.created_at DESC/);
    expect(list.params).toEqual([
      OWNER.id,
      'booking',
      // Every parent kind the contract names, including the in-stay changes, in its order.
      [...PARENT_BOOKING_NOTIFICATION_KINDS],
      5,
    ]);
    expect(statement(1).params[0]).toBe(OWNER.id);
  });

  it('never takes the owner from the request', async () => {
    poolQuery.mockResolvedValue({ rows: [] });

    const response = await request(createApp())
      .get(`${URL}?ownerId=${OTHER_OWNER.id}`)
      .set('Cookie', await cookieFor(OWNER));

    expect(response.status).toBe(400);
    expect(poolQuery).not.toHaveBeenCalled();
  });

  it('refuses a guest, and staff even when they are managers', async () => {
    const guest = await request(createApp()).get(URL);
    const staff = await request(createApp())
      .get(URL)
      .set('Cookie', await cookieFor(STAFF));
    const manager = await request(createApp())
      .get(URL)
      .set('Cookie', await cookieFor(MANAGER));

    expect(guest.status).toBe(401);
    expect(staff.status).toBe(403);
    expect(manager.status).toBe(403);
    expect(poolQuery).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/petparent/notifications/:id/read', () => {
  it("marks the parent's own notice read", async () => {
    const readAt = new Date('2026-10-02T00:00:00.000Z');
    poolQuery.mockResolvedValue({ rows: [{ id: NOTICE_ID, read_at: readAt }] });

    const response = await request(createApp())
      .patch(`${URL}/${NOTICE_ID}/read`)
      .set('Cookie', await cookieFor(OWNER));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: NOTICE_ID, readAt: readAt.toISOString() });
    const update = statement(0);
    expect(update.sql).toContain('pon.pet_owners_uuid = $1::uuid');
    expect(update.sql).toContain('COALESCE(n.read_at, now())');
    expect(update.params[0]).toBe(OWNER.id);
    expect(update.params[3]).toBe(NOTICE_ID);
  });

  it("answers another parent's notice exactly like one that does not exist", async () => {
    // The ownership condition is in the UPDATE, so another owner's row matches nothing.
    poolQuery.mockResolvedValue({ rows: [] });

    const response = await request(createApp())
      .patch(`${URL}/${NOTICE_ID}/read`)
      .set('Cookie', await cookieFor(OTHER_OWNER));

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOTIFICATION_NOT_FOUND');
    expect(statement(0).params[0]).toBe(OTHER_OWNER.id);
  });

  it('refuses an id that is not a UUID, and a staff session', async () => {
    const badId = await request(createApp())
      .patch(`${URL}/not-an-id/read`)
      .set('Cookie', await cookieFor(OWNER));
    const staff = await request(createApp())
      .patch(`${URL}/${NOTICE_ID}/read`)
      .set('Cookie', await cookieFor(STAFF));

    expect(badId.status).toBe(400);
    expect(staff.status).toBe(403);
    expect(poolQuery).not.toHaveBeenCalled();
  });

  it('refuses a write from another site before reading the session', async () => {
    const response = await request(createApp())
      .patch(`${URL}/${NOTICE_ID}/read`)
      .set('Origin', 'https://attacker.example')
      .set('Cookie', await cookieFor(OWNER));

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('UNTRUSTED_ORIGIN');
    expect(poolQuery).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/petparent/notifications/read-all', () => {
  it('marks read only what the bell showed, for the signed-in parent', async () => {
    const readAt = new Date('2026-10-02T00:00:00.000Z');
    poolQuery.mockResolvedValue({ rows: [{ id: NOTICE_ID, read_at: readAt }] });

    const response = await request(createApp())
      .patch(`${URL}/read-all`)
      .set('Cookie', await cookieFor(OWNER))
      .send({ through: CREATED_AT.toISOString() });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ updatedIds: [NOTICE_ID], readAt: readAt.toISOString() });
    const update = statement(0);
    expect(update.sql).toContain('pon.pet_owners_uuid = $1::uuid');
    expect(update.sql).toContain("date_trunc('milliseconds', n.created_at) <= $4::timestamptz");
    expect(update.params[0]).toBe(OWNER.id);
    expect(update.params[3]).toEqual(CREATED_AT);
  });

  it('marks every unread notice when no limit is given', async () => {
    poolQuery.mockResolvedValue({ rows: [] });

    const response = await request(createApp())
      .patch(`${URL}/read-all`)
      .set('Cookie', await cookieFor(OWNER));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ updatedIds: [], readAt: null });
    expect(statement(0).params[3]).toBeNull();
  });

  it('refuses an unknown field or a date that is not a timestamp', async () => {
    const cookie = await cookieFor(OWNER);
    const unknownField = await request(createApp())
      .patch(`${URL}/read-all`)
      .set('Cookie', cookie)
      .send({ ownerId: OTHER_OWNER.id });
    const badDate = await request(createApp())
      .patch(`${URL}/read-all`)
      .set('Cookie', cookie)
      .send({ through: 'yesterday' });

    expect(unknownField.status).toBe(400);
    expect(badDate.status).toBe(400);
    expect(poolQuery).not.toHaveBeenCalled();
  });
});
