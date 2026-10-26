import { Router } from 'express';
import {
  getAllBookings,
  approveBooking,
  refuseBooking,
  undoBookingReview,
  recordArrival,
  finishCheckIn,
  cancelWithoutFee,
  rescheduleWithoutCharge,
  getStayChangeRequests,
  approveStayChangeRequest,
  refuseStayChangeRequest,
} from '../controllers/manager.booking.controller.js';
import { requireEmployee, requireManager } from '../common/middlewares/auth.middleware.js';

const router = Router();

// Every employee sees the bookings and works the desk: staff record who arrived and finish
// check-in, whose charge the server works out from the rules. Decisions that need judgement stay
// with a manager: approving or refusing a stay, turning a pet away at the desk (checked in the
// controller), and cancelling or moving a stay without a fee.
router.get('/', requireEmployee, getAllBookings);
// A parent's request to change a stay under way: every employee sees them, a manager decides.
router.get('/change-requests', requireEmployee, getStayChangeRequests);
router.patch('/change-requests/:requestId/approve', requireManager, approveStayChangeRequest);
router.patch('/change-requests/:requestId/refuse', requireManager, refuseStayChangeRequest);
// Per pet (:id is a booking_pets id).
router.patch('/:id/approve', requireManager, approveBooking);
router.patch('/:id/refuse', requireManager, refuseBooking);
router.patch('/:id/undo', requireManager, undoBookingReview);
router.patch('/:id/check-in', requireEmployee, recordArrival);
// Per booking: these move money for the whole booking.
router.post('/by-booking/:bookingId/finish-check-in', requireEmployee, finishCheckIn);
router.post('/by-booking/:bookingId/cancel', requireManager, cancelWithoutFee);
router.post('/by-booking/:bookingId/reschedule', requireManager, rescheduleWithoutCharge);

export default router;
