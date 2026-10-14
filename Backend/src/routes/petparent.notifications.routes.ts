import { Router } from 'express';
import {
  listNotifications,
  markNotificationRead,
  readAllNotifications,
} from '../controllers/petparent.notifications.controller.js';
import { requirePetParent, requireTrustedOrigin } from '../common/middlewares/auth.middleware.js';

const router = Router();

router.get('/', requirePetParent, listNotifications);
// The origin check runs first, as on the vaccination upload: a cross-site write is refused before
// the session is even read.
router.patch('/read-all', requireTrustedOrigin, requirePetParent, readAllNotifications);
router.patch('/:id/read', requireTrustedOrigin, requirePetParent, markNotificationRead);

export default router;
