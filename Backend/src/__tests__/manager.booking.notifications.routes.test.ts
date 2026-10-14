import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  DecisionNoticeComposer,
  ReviewedBookingPet,
} from '../repositories/manager.booking.review.repository.js';
import {
  MANAGER,
  OWNER,
  STAFF,
  cookieFor,
  findTestUser,
  useTestSessionSecret,
} from './fixtures/notification.routes.fixtures.js';

// A manager's decision reaches the parent: each route hands the repository the notice rule for
// its event, and only a manager's session can make a decision at all.

const emails = vi.hoisted(() => ({ sendBookingNoticeEmail: vi.fn() }));
vi.mock('../services/booking.transaction-emails.js', () => emails);

const review = vi.hoisted(() => ({
  approveBookingPet: vi.fn(),
  refuseBookingPet: vi.fn(),
  resetBookingPetReview: vi.fn(),
}));
const tasks = vi.hoisted(() => ({
  createTasksForBookingPet: vi.fn(),
  deleteTasksForBookingPet: vi.fn(),
}));
const desk = vi.hoisted(() => ({
  findBookingIdOfPet: vi.fn(),
  withLockedBooking: vi.fn(),
}));

vi.mock('../config/database.js', () => ({ pool: { query: vi.fn(), connect: vi.fn() } }));
vi.mock('../repositories/manager.booking.review.repository.js', () => review);
vi.mock('../services/task.fromBooking.service.js', () => tasks);
vi.mock('../repositories/booking.check-in.repository.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../repositories/booking.check-in.repository.js')>()),
  ...desk,
}));
vi.mock('../repositories/auth.repository.js', () => ({
  createPetParentAccount: vi.fn(),
  createGooglePetParentAccount: vi.fn(),
  findUserByCredentials: vi.fn(),
  findUserByEmail: vi.fn(),
  findUserById: vi.fn((id: string) => findTestUser(id)),
  findUserByUsername: vi.fn(),
}));

import { pool } from '../config/database.js';
import { errorHandler } from '../common/middlewares/error.middleware.js';
import managerBookingRoutes from '../routes/manager.booking.routes.js';
import { lockedBooking, lockedPet } from './support/lockedBookingFixtures.js';

const BOOKING_PET_ID = '00000000-0000-4000-8000-000000000601';
const URL = `/api/admin/bookings/${BOOKING_PET_ID}`;

const REVIEWED: ReviewedBookingPet = {
  bookingId: '00000000-0000-4000-8000-000000000501',
  ownerId: OWNER.id,
  subject: {
    petNames: ['Max'],
    dropOffTime: new Date('2026-10-11T20:00:00.000Z'),
    pickUpTime: new Date('2026-10-15T04:00:00.000Z'),
  },
  previousStatus: 'pending',
  previousRefusalReason: null,
};

const createApp = (): express.Express => {
  const app = express();
  app.use(express.json());
  app.use('/api/admin/bookings', managerBookingRoutes);
  app.use(errorHandler);
  return app;
};

/** The notice the route's rule writes for a pet that is waiting for review. */
const composerPassedTo = (mock: ReturnType<typeof vi.fn>, argument: number): unknown => {
  const compose = mock.mock.calls[0]?.[argument] as DecisionNoticeComposer | undefined;
  return compose?.(REVIEWED);
};

beforeEach(() => {
  useTestSessionSecret();
  vi.clearAllMocks();
  review.approveBookingPet.mockResolvedValue(true);
  review.refuseBookingPet.mockResolvedValue(true);
  review.resetBookingPetReview.mockResolvedValue(true);
  // A request without a saved card, whose one pet waits for review: no hold moves.
  const request = lockedBooking({
    payment: null,
    pets: [lockedPet({ bookingPetsUuid: BOOKING_PET_ID, reviewStatus: 'pending' })],
  });
  desk.findBookingIdOfPet.mockResolvedValue(request.bookingId);
  desk.withLockedBooking.mockImplementation(
    async (_bookingId: string, work: (booking: typeof request, client: object) => unknown) =>
      work(request, {}),
  );
});

describe('manager decisions tell the parent', () => {
  it('approve writes the "approved" notice and then creates the care tasks', async () => {
    const response = await request(createApp())
      .patch(`${URL}/approve`)
      .set('Cookie', await cookieFor(MANAGER));

    expect(response.status).toBe(204);
    // The signed-in manager is recorded as the one who approved.
    expect(review.approveBookingPet.mock.calls[0]?.slice(0, 2)).toEqual([
      BOOKING_PET_ID,
      MANAGER.id,
    ]);
    expect(composerPassedTo(review.approveBookingPet, 2)).toMatchObject({
      ownerId: OWNER.id,
      kind: 'booking_approved',
    });
    expect(tasks.createTasksForBookingPet).toHaveBeenCalledWith(BOOKING_PET_ID);
  });

  it('refuse writes the "not accepted" notice with the reason', async () => {
    const response = await request(createApp())
      .patch(`${URL}/refuse`)
      .set('Cookie', await cookieFor(MANAGER))
      .send({ reason: 'We are full that week.' });

    expect(response.status).toBe(204);
    expect(review.refuseBookingPet.mock.calls[0]?.slice(0, 3)).toEqual([
      BOOKING_PET_ID,
      MANAGER.id,
      'We are full that week.',
    ]);
    expect(composerPassedTo(review.refuseBookingPet, 3)).toMatchObject({
      kind: 'booking_refused',
      body: expect.stringContaining('Reason: We are full that week.'),
    });
  });

  it('undo writes the "back in review" notice once a decision is undone', async () => {
    const response = await request(createApp())
      .patch(`${URL}/undo`)
      .set('Cookie', await cookieFor(MANAGER));

    expect(response.status).toBe(204);
    const compose = review.resetBookingPetReview.mock.calls[0]?.[1] as DecisionNoticeComposer;
    expect(compose({ ...REVIEWED, previousStatus: 'approved' })).toMatchObject({
      kind: 'booking_back_in_review',
    });
    expect(tasks.deleteTasksForBookingPet).toHaveBeenCalledWith(BOOKING_PET_ID);
  });

  it('answers 404 and creates no tasks for an unknown booking pet', async () => {
    review.approveBookingPet.mockResolvedValue(false);

    const response = await request(createApp())
      .patch(`${URL}/approve`)
      .set('Cookie', await cookieFor(MANAGER));

    expect(response.status).toBe(404);
    expect(tasks.createTasksForBookingPet).not.toHaveBeenCalled();
  });

  it('lets no pet parent or non-manager staff decide, so no notice is written', async () => {
    const parent = await request(createApp())
      .patch(`${URL}/approve`)
      .set('Cookie', await cookieFor(OWNER));
    const staff = await request(createApp())
      .patch(`${URL}/refuse`)
      .set('Cookie', await cookieFor(STAFF))
      .send({ reason: 'Full.' });
    const guest = await request(createApp()).patch(`${URL}/undo`);

    expect(parent.status).toBe(403);
    expect(staff.status).toBe(403);
    expect(guest.status).toBe(401);
    expect(review.approveBookingPet).not.toHaveBeenCalled();
    expect(review.refuseBookingPet).not.toHaveBeenCalled();
    expect(review.resetBookingPetReview).not.toHaveBeenCalled();
  });
});

describe('who can see the bookings', () => {
  it('shows the list to staff as well as managers, so staff know which pets are coming', async () => {
    vi.mocked(pool.query).mockResolvedValue({ rows: [] } as never);

    const staff = await request(createApp())
      .get('/api/admin/bookings')
      .set('Cookie', await cookieFor(STAFF));
    const manager = await request(createApp())
      .get('/api/admin/bookings')
      .set('Cookie', await cookieFor(MANAGER));

    expect(staff.status).toBe(200);
    expect(manager.status).toBe(200);
    expect(staff.body).toEqual([]);
  });

  it('keeps the list from pet parents and guests', async () => {
    const parent = await request(createApp())
      .get('/api/admin/bookings')
      .set('Cookie', await cookieFor(OWNER));
    const guest = await request(createApp()).get('/api/admin/bookings');

    expect(parent.status).toBe(403);
    expect(guest.status).toBe(401);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('lets staff record who arrived and finish check-in', async () => {
    const cookie = await cookieFor(STAFF);
    const BOOKING_ID = '00000000-0000-4000-8000-000000000501';

    const arrival = await request(createApp())
      .patch(`${URL}/check-in`)
      .set('Cookie', cookie)
      .send({ outcome: 'no_show' });
    const finish = await request(createApp())
      .post(`/api/admin/bookings/by-booking/${BOOKING_ID}/finish-check-in`)
      .set('Cookie', cookie);

    // Past the permission check: the desk service ran (and judged the stay on its own rules).
    expect(arrival.status).not.toBe(403);
    expect(arrival.body.error?.code).not.toBe('FORBIDDEN');
    expect(finish.status).not.toBe(403);
    expect(desk.withLockedBooking).toHaveBeenCalled();
  });

  it('keeps turning a pet away, cancelling without a fee and moving a stay with a manager', async () => {
    const cookie = await cookieFor(STAFF);
    const BOOKING_ID = '00000000-0000-4000-8000-000000000501';

    const responses = await Promise.all([
      request(createApp())
        .patch(`${URL}/check-in`)
        .set('Cookie', cookie)
        .send({ outcome: 'wagstay_unable' }),
      request(createApp())
        .post(`/api/admin/bookings/by-booking/${BOOKING_ID}/cancel`)
        .set('Cookie', cookie)
        .send({ reason: 'Storm' }),
      request(createApp())
        .post(`/api/admin/bookings/by-booking/${BOOKING_ID}/reschedule`)
        .set('Cookie', cookie)
        .send({ reason: 'Storm' }),
    ]);

    expect(responses.map((response) => response.status)).toEqual([403, 403, 403]);
    expect(responses[0]?.body.error.code).toBe('FORBIDDEN');
    expect(desk.withLockedBooking).not.toHaveBeenCalled();
  });

  it('lets a manager turn a pet away at the desk', async () => {
    const response = await request(createApp())
      .patch(`${URL}/check-in`)
      .set('Cookie', await cookieFor(MANAGER))
      .send({ outcome: 'wagstay_unable' });

    // Past the permission check; the desk service then judges the stay on its own rules.
    expect(response.status).not.toBe(403);
    expect(response.body.error?.code).not.toBe('FORBIDDEN');
  });
});

describe('decision email transaction boundary', () => {
  it.each(['approve', 'refuse'] as const)('sends %s only after commit', async (decision) => {
    const events: string[] = [];
    review.approveBookingPet.mockImplementation(
      async (_id: string, _reviewerId: string, compose: DecisionNoticeComposer) => {
        compose(REVIEWED);
        events.push('decision');
        return true;
      },
    );
    review.refuseBookingPet.mockImplementation(
      async (
        _id: string,
        _reviewerId: string,
        _reason: string,
        compose: DecisionNoticeComposer,
      ) => {
        compose(REVIEWED);
        events.push('decision');
        return true;
      },
    );
    const original = desk.withLockedBooking.getMockImplementation();
    desk.withLockedBooking.mockImplementation(async (...args: unknown[]) => {
      const result = await original?.(...args);
      events.push('commit');
      return result;
    });
    emails.sendBookingNoticeEmail.mockImplementation(async () => {
      events.push('email');
    });
    const response = await request(createApp())
      .patch(`${URL}/${decision}`)
      .set('Cookie', await cookieFor(MANAGER))
      .send({ reason: 'Full.' });
    expect(response.status).toBe(204);
    expect(events).toEqual(['decision', 'commit', 'email']);
    expect(emails.sendBookingNoticeEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: OWNER.id,
        kind: decision === 'approve' ? 'booking_approved' : 'booking_refused',
      }),
    );
  });

  it('answers the manager without waiting for the mail provider', async () => {
    review.approveBookingPet.mockImplementation(
      async (_id: string, _reviewerId: string, compose: DecisionNoticeComposer) => {
        compose(REVIEWED);
        return true;
      },
    );
    emails.sendBookingNoticeEmail.mockReturnValueOnce(new Promise(() => undefined));

    const response = await request(createApp())
      .patch(`${URL}/approve`)
      .set('Cookie', await cookieFor(MANAGER));

    expect(response.status).toBe(204);
    expect(emails.sendBookingNoticeEmail).toHaveBeenCalledTimes(1);
  });

  it('does not send when commit fails after the notice is composed', async () => {
    review.approveBookingPet.mockImplementation(
      async (_id: string, _reviewerId: string, compose: DecisionNoticeComposer) => {
        compose(REVIEWED);
        return true;
      },
    );
    const original = desk.withLockedBooking.getMockImplementation();
    desk.withLockedBooking.mockImplementation(async (...args: unknown[]) => {
      await original?.(...args);
      throw new Error('commit failed');
    });
    const response = await request(createApp())
      .patch(`${URL}/approve`)
      .set('Cookie', await cookieFor(MANAGER));
    expect(response.status).toBe(500);
    expect(emails.sendBookingNoticeEmail).not.toHaveBeenCalled();
    expect(tasks.createTasksForBookingPet).not.toHaveBeenCalled();
  });

  it('passes no email draft when approval repeats', async () => {
    review.approveBookingPet.mockImplementation(
      async (_id: string, _reviewerId: string, compose: DecisionNoticeComposer) => {
        compose({ ...REVIEWED, previousStatus: 'approved' });
        return true;
      },
    );
    const response = await request(createApp())
      .patch(`${URL}/approve`)
      .set('Cookie', await cookieFor(MANAGER));
    expect(response.status).toBe(204);
    expect(emails.sendBookingNoticeEmail).toHaveBeenCalledWith(null);
  });
});
