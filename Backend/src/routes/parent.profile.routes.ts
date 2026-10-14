import { Router } from 'express';
import {
  createParentPet,
  deleteParentPet,
  getParentProfile,
  updateParentOwner,
  updateParentPet,
} from '../controllers/parent.profile.controller.js';
import {
  getNotificationPreferences,
  putNotificationPreferences,
} from '../controllers/parent.notification-preferences.controller.js';
import {
  deleteContactHandler,
  getContacts,
  patchContact,
  postContact,
} from '../controllers/parent.contacts.controller.js';
import { requirePetParent } from '../common/middlewares/auth.middleware.js';

const router = Router();

// A parent's profile is their own account record, not a public lookup. Every
// route here needs a signed-in pet owner, and the controllers double-check
// that the id in the URL is that same owner before reading or writing it.
router.use(requirePetParent);

// `pets/:petId` is declared before `:ownerId` so the literal segment is not
// captured as an owner id.
router.get('/', getParentProfile);
// How the parent hears from us: language, the hour of the daily update, quiet hours, email.
router.get('/notification-preferences', getNotificationPreferences);
router.put('/notification-preferences', putNotificationPreferences);
// The parent's emergency contacts (Privacy Act IPP 3A: the parent confirms they told the person).
router.get('/contacts', getContacts);
router.post('/contacts', postContact);
router.patch('/contacts/:contactId', patchContact);
router.delete('/contacts/:contactId', deleteContactHandler);
router.patch('/pets/:petId', updateParentPet);
router.delete('/pets/:petId', deleteParentPet);
router.post('/:ownerId/pets', createParentPet);
router.patch('/:ownerId', updateParentOwner);

export default router;
