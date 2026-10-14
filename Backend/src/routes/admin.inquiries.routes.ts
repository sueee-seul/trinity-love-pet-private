import { Router } from 'express';
import {
  assignStaff,
  createInquiryMessage,
  getInquiry,
  listInquiries,
  resolveInquiry,
  streamInquiry,
  streamInquiryList,
  updateInquiryNotes,
} from '../controllers/admin.inquiries.controller.js';
import { requireEmployee, requireManager } from '../common/middlewares/auth.middleware.js';

const router = Router();

router.use(requireEmployee);

router.get('/', listInquiries);
// Must come before `/:conversationId` - otherwise Express would match "stream" as a conversation id.
router.get('/stream', streamInquiryList);
router.get('/:conversationId', getInquiry);
router.get('/:conversationId/stream', streamInquiry);
// Only a manager may reassign - matches the `isManager` gate on the assign UI itself.
router.patch('/:conversationId/assignee', requireManager, assignStaff);
router.post('/:conversationId/resolve', resolveInquiry);
router.post('/:conversationId/messages', createInquiryMessage);
router.patch('/:conversationId/notes', updateInquiryNotes);

export default router;
