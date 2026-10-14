import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../common/middlewares/error.middleware.js';
import petparentBookingRoutes from '../routes/petparent.booking.routes.js';
import { bookAddOn, listAddOns } from '../services/booking.guest-addon.js';
import { cancelByGuest, previewCancellation } from '../services/booking.guest-change.js';
import { extendStay, previewExtension } from '../services/booking.guest-extend.js';
import { previewReschedule, rescheduleByGuest } from '../services/booking.guest-reschedule.js';
import { changeStayTimes } from '../services/booking.guest-times.js';

const OWNER = '00000000-0000-4000-8000-000000000101';
const BOOKING = '00000000-0000-4000-8000-000000000601';

vi.mock('../common/middlewares/auth.middleware.js', () => ({
  requirePetParent: (req: Request, _res: Response, next: NextFunction): void => {
    req.user = {
      id: '00000000-0000-4000-8000-000000000101',
      email: 'ava@example.test',
      name: 'Ava Mitchell',
      is_employee: false,
      is_pet_owner: true,
      employee_role: null,
      isUsingTemporaryPassword: false,
    };
    next();
  },
}));

vi.mock('../services/booking.guest-change.js', () => ({
  previewCancellation: vi.fn(async () => ({ fee: 230, rule: 'late', total: 460, contact: {} })),
  cancelByGuest: vi.fn(async () => ({ fee: 230 })),
}));

vi.mock('../services/booking.guest-reschedule.js', () => ({
  previewReschedule: vi.fn(async () => ({ total: 460 })),
  rescheduleByGuest: vi.fn(async () => ({ total: 460, held: false })),
}));

vi.mock('../services/booking.guest-extend.js', () => ({
  previewExtension: vi.fn(async () => ({ amount: 240 })),
  extendStay: vi.fn(async () => ({ amount: 240, chargeId: 'c1' })),
}));

vi.mock('../services/booking.guest-addon.js', () => ({
  listAddOns: vi.fn(async () => ({ offers: [], days: [] })),
  bookAddOn: vi.fn(async () => ({ amount: 15 })),
}));

vi.mock('../services/booking.guest-times.js', () => ({
  changeStayTimes: vi.fn(async () => ({ dropOffAt: 'x', pickUpAt: 'y' })),
}));

const app = express();
app.use(express.json());
app.use('/api/petparent', petparentBookingRoutes);
app.use(errorHandler);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('a guest changing their own stay', () => {
  it('sees what cancelling costs, then cancels, as the signed-in owner', async () => {
    const preview = await request(app)
      .get(`/api/petparent/bookings/${BOOKING}/cancellation`)
      .expect(200);
    expect(preview.body).toMatchObject({ fee: 230, rule: 'late' });
    expect(previewCancellation).toHaveBeenCalledWith(OWNER, BOOKING);

    await request(app).post(`/api/petparent/bookings/${BOOKING}/cancel`).expect(200);
    expect(cancelByGuest).toHaveBeenCalledWith(OWNER, BOOKING, {});
  });

  it('prices new dates from the query, then moves to the dates in the body', async () => {
    await request(app)
      .get(`/api/petparent/bookings/${BOOKING}/reschedule`)
      .query({ startDate: '2026-12-19', endDate: '2026-12-22' })
      .expect(200);
    expect(previewReschedule).toHaveBeenCalledWith(OWNER, BOOKING, {
      startDate: '2026-12-19',
      endDate: '2026-12-22',
    });

    await request(app)
      .post(`/api/petparent/bookings/${BOOKING}/reschedule`)
      .send({ startDate: '2026-12-19', endDate: '2026-12-22' })
      .expect(200);
    expect(rescheduleByGuest).toHaveBeenCalledWith(OWNER, BOOKING, {
      startDate: '2026-12-19',
      endDate: '2026-12-22',
    });
  });

  it('passes the previewed amounts on, so the server can refuse a changed one', async () => {
    await request(app)
      .post(`/api/petparent/bookings/${BOOKING}/cancel`)
      .send({ expectedFee: 230 })
      .expect(200);
    expect(cancelByGuest).toHaveBeenCalledWith(OWNER, BOOKING, { expectedFee: 230 });

    await request(app)
      .post(`/api/petparent/bookings/${BOOKING}/reschedule`)
      .send({ startDate: '2026-12-19', endDate: '2026-12-22', expectedTotal: 460 })
      .expect(200);
    expect(rescheduleByGuest).toHaveBeenCalledWith(OWNER, BOOKING, {
      startDate: '2026-12-19',
      endDate: '2026-12-22',
      expectedTotal: 460,
    });

    // A negative or unknown field is a bad request, not a cancellation at some other fee.
    await request(app)
      .post(`/api/petparent/bookings/${BOOKING}/cancel`)
      .send({ expectedFee: -1 })
      .expect(400);
    await request(app)
      .post(`/api/petparent/bookings/${BOOKING}/cancel`)
      .send({ fee: 230 })
      .expect(400);
  });

  it('prices and applies the changes to a stay under way for the signed-in owner', async () => {
    const PET = '00000000-0000-4000-8000-000000000701';
    const SERVICE = '00000000-0000-4000-8000-000000000801';

    await request(app)
      .get(`/api/petparent/bookings/${BOOKING}/extension`)
      .query({ endDate: '2026-12-17' })
      .expect(200);
    expect(previewExtension).toHaveBeenCalledWith(OWNER, BOOKING, '2026-12-17');
    await request(app)
      .post(`/api/petparent/bookings/${BOOKING}/extension`)
      .send({ endDate: '2026-12-17', expectedAmount: 240 })
      .expect(200);
    expect(extendStay).toHaveBeenCalledWith(OWNER, BOOKING, {
      endDate: '2026-12-17',
      expectedAmount: 240,
    });

    // Early pick-up was removed on 7 Oct 2026: the route is gone.
    await request(app)
      .post(`/api/petparent/bookings/${BOOKING}/early-pickup`)
      .send({ pickUpAt: '2026-12-13T21:00:00.000Z', expectedRefund: 60 })
      .expect(404);

    await request(app).get(`/api/petparent/bookings/${BOOKING}/add-ons`).expect(200);
    expect(listAddOns).toHaveBeenCalledWith(OWNER, BOOKING);
    await request(app)
      .post(`/api/petparent/bookings/${BOOKING}/pets/${PET}/add-ons`)
      .send({ serviceId: SERVICE, date: '2026-12-14', expectedAmount: 15 })
      .expect(200);
    // The quantity defaults to one.
    expect(bookAddOn).toHaveBeenCalledWith(OWNER, BOOKING, PET, {
      serviceId: SERVICE,
      date: '2026-12-14',
      quantity: 1,
      expectedAmount: 15,
    });

    await request(app)
      .patch(`/api/petparent/bookings/${BOOKING}/pets/${PET}/times`)
      .send({ pickUpTime: '12:30' })
      .expect(200);
    expect(changeStayTimes).toHaveBeenCalledWith(OWNER, BOOKING, PET, { pickUpTime: '12:30' });
  });

  it('refuses malformed in-stay changes before any service runs', async () => {
    const PET = '00000000-0000-4000-8000-000000000701';
    await request(app)
      .post(`/api/petparent/bookings/${BOOKING}/extension`)
      .send({ endDate: 'soon' })
      .expect(400);
    await request(app)
      .post(`/api/petparent/bookings/${BOOKING}/pets/${PET}/add-ons`)
      .send({ serviceId: 'walk', date: '2026-12-14' })
      .expect(400);
    await request(app)
      .post(`/api/petparent/bookings/${BOOKING}/pets/${PET}/add-ons`)
      .send({ serviceId: '00000000-0000-4000-8000-000000000801', date: '2026-12-14', quantity: 9 })
      .expect(400);
    await request(app)
      .patch(`/api/petparent/bookings/${BOOKING}/pets/${PET}/times`)
      .send({})
      .expect(400);
    await request(app)
      .patch(`/api/petparent/bookings/${BOOKING}/pets/${PET}/times`)
      .send({ pickUpTime: '25:00' })
      .expect(400);
    expect(extendStay).not.toHaveBeenCalled();
    expect(bookAddOn).not.toHaveBeenCalled();
    expect(changeStayTimes).not.toHaveBeenCalled();
  });

  it('refuses dates that are not dates, and a booking id that is not one', async () => {
    await request(app)
      .post(`/api/petparent/bookings/${BOOKING}/reschedule`)
      .send({ startDate: 'next week', endDate: '2026-12-22' })
      .expect(400);
    await request(app).post('/api/petparent/bookings/PB-AAAAAA/cancel').expect(400);
    expect(rescheduleByGuest).not.toHaveBeenCalled();
    expect(cancelByGuest).not.toHaveBeenCalled();
  });
});
