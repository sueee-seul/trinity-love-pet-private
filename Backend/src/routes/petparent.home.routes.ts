import { Router } from 'express';
import { getHome } from '../controllers/petparent.home.controller.js';
import { requirePetParent } from '../common/middlewares/auth.middleware.js';

const router = Router();

router.get('/home', requirePetParent, getHome);

export default router;
