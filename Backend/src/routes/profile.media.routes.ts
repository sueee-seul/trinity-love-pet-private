import { Router } from 'express';
import { cleanupUpload, createUploadUrl } from '../controllers/profile.media.controller.js';
import { requireAuth, requireTrustedOrigin } from '../common/middlewares/auth.middleware.js';

const router = Router();

router.post('/upload-url', requireAuth, requireTrustedOrigin, createUploadUrl);
router.delete('/upload', requireAuth, requireTrustedOrigin, cleanupUpload);

export default router;
