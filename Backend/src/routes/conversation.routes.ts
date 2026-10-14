import { Router } from 'express';
import {
  closeConversation,
  createConversation,
  createMessage,
  getConversation,
  listConversations,
  requestSupport,
  streamConversation,
} from '../controllers/conversation.controller.js';
import { requirePetParent } from '../common/middlewares/auth.middleware.js';

const router = Router();

router.use(requirePetParent);

router.get('/', listConversations);
router.post('/', createConversation);
router.get('/:conversationId', getConversation);
router.get('/:conversationId/stream', streamConversation);
router.post('/:conversationId/messages', createMessage);
router.post('/:conversationId/close', closeConversation);
router.post('/:conversationId/request-support', requestSupport);

export default router;
