import { Router } from 'express';
import {
  getPets,
  getServices,
  getMyBookings,
} from '../controllers/petparent.booking.controller.js';
import {
  cancelStay,
  getCancellation,
  getReschedule,
  rescheduleStay,
} from '../controllers/petparent.stay-change.controller.js';
import {
  getAddOns,
  getExtension,
  patchTimes,
  postAddOn,
  postExtension,
} from '../controllers/petparent.in-stay.controller.js';
import { requirePetParent } from '../common/middlewares/auth.middleware.js';

const router = Router();

router.get('/pets', requirePetParent, getPets);
router.get('/services', requirePetParent, getServices);
// Read only: new bookings come through the concierge checkout (POST /api/concierge/checkout),
// which takes no card numbers and books only pets on the caller's account.
router.get('/bookings', requirePetParent, getMyBookings);
// A guest changing their own stay: see what it costs first, then do it.
router.get('/bookings/:bookingId/cancellation', requirePetParent, getCancellation);
router.post('/bookings/:bookingId/cancel', requirePetParent, cancelStay);
router.get('/bookings/:bookingId/reschedule', requirePetParent, getReschedule);
router.post('/bookings/:bookingId/reschedule', requirePetParent, rescheduleStay);
// While the pet is staying: priced first (GET), then applied with the amount the parent saw (POST).
router.get('/bookings/:bookingId/extension', requirePetParent, getExtension);
router.post('/bookings/:bookingId/extension', requirePetParent, postExtension);
router.get('/bookings/:bookingId/add-ons', requirePetParent, getAddOns);
router.post('/bookings/:bookingId/pets/:bookingPetId/add-ons', requirePetParent, postAddOn);
router.patch('/bookings/:bookingId/pets/:bookingPetId/times', requirePetParent, patchTimes);

export default router;
