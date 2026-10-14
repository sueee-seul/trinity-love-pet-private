import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../common/middlewares/error.middleware.js';
import managerBookingRoutes from '../routes/manager.booking.routes.js';
import { cancelWithoutFee, finishCheckIn, recordArrival } from '../services/booking.check-in.js';
import { rescheduleForException } from '../services/manager.booking.js';

vi.mock('../common/middlewares/auth.middleware.js', () => ({
  requireEmployee: (_req: Request, _res: Response, next: NextFunction): void => next(),
  requireManager: (_req: Request, _res: Response, next: NextFunction): void => next(),
}));

vi.mock('../services/booking.check-in.js', () => ({
  recordArrival: vi.fn(async () => undefined),
  finishCheckIn: vi.fn(async () => ({ result: 'charged', amount: 345 })),
  cancelWithoutFee: vi.fn(async () => undefined),
}));

vi.mock('../services/manager.booking.js', () => ({
  getAllBookings: vi.fn(),
  approveBooking: vi.fn(),
  refuseBooking: vi.fn(),
  undoBookingReview: vi.fn(),
  rescheduleForException: vi.fn(async () => ({ total: 460, held: false })),
}));

const app = express();
app.use(express.json());
app.use('/api/admin/bookings', managerBookingRoutes);
app.use(errorHandler);

const PET = '00000000-0000-4000-8000-000000000501';
const BOOKING = '00000000-0000-4000-8000-000000000601';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('manager booking desk routes', () => {
  it("records one pet's arrival", async () => {
    await request(app)
      .patch(`/api/admin/bookings/${PET}/check-in`)
      .send({ outcome: 'no_show' })
      .expect(204);

    expect(recordArrival).toHaveBeenCalledWith(PET, 'no_show');
  });

  it('refuses an outcome it does not know', async () => {
    const response = await request(app)
      .patch(`/api/admin/bookings/${PET}/check-in`)
      .send({ outcome: 'maybe' })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_FAILED');
    expect(recordArrival).not.toHaveBeenCalled();
  });

  it('finishes check-in for the whole booking and says what was charged', async () => {
    const response = await request(app)
      .post(`/api/admin/bookings/by-booking/${BOOKING}/finish-check-in`)
      .expect(200);

    expect(response.body).toEqual({ result: 'charged', amount: 345 });
    expect(finishCheckIn).toHaveBeenCalledWith(BOOKING);
  });

  it('cancels without a fee only with a reason', async () => {
    await request(app)
      .post(`/api/admin/bookings/by-booking/${BOOKING}/cancel`)
      .send({})
      .expect(400);
    expect(cancelWithoutFee).not.toHaveBeenCalled();

    await request(app)
      .post(`/api/admin/bookings/by-booking/${BOOKING}/cancel`)
      .send({ reason: 'MetService red warning' })
      .expect(204);
    expect(cancelWithoutFee).toHaveBeenCalledWith(BOOKING, 'MetService red warning');
  });

  it('moves a stay without a charge only with dates and a reason', async () => {
    const dates = { startDate: '2026-12-19', endDate: '2026-12-22' };
    await request(app)
      .post(`/api/admin/bookings/by-booking/${BOOKING}/reschedule`)
      .send(dates)
      .expect(400);
    expect(rescheduleForException).not.toHaveBeenCalled();

    await request(app)
      .post(`/api/admin/bookings/by-booking/${BOOKING}/reschedule`)
      .send({ ...dates, reason: 'Civil defence emergency' })
      .expect(200);
    expect(rescheduleForException).toHaveBeenCalledWith(BOOKING, dates, 'Civil defence emergency');
  });

  it('rejects an id that is not a booking id', async () => {
    await request(app).post('/api/admin/bookings/by-booking/PB-1A2B3C/finish-check-in').expect(400);
    expect(finishCheckIn).not.toHaveBeenCalled();
  });
});
