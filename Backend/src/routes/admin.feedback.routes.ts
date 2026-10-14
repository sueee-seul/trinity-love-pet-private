import { Router } from 'express';
import {
  getFeedbackList,
  getFeedbackAssignees,
  getFeedbackSnapshot,
  assignFeedbacks,
  markFeedbacksAsRead,
  getFeedbackDetail,
  deleteFeedback,
  updateFeedbackStatus,
  updateSuggestionWorkflow,
  replyToFeedback,
} from '../controllers/admin.feedback.controller.js';
import { requireEmployee, requireTrustedOrigin } from '../common/middlewares/auth.middleware.js';

const router = Router();

router.use(requireEmployee);
router.get('/', getFeedbackList);
router.get('/assignees', getFeedbackAssignees);
router.get('/snapshot', getFeedbackSnapshot);
router.patch('/assignee', requireTrustedOrigin, assignFeedbacks);
router.patch('/read', requireTrustedOrigin, markFeedbacksAsRead);
router.get('/:id', requireTrustedOrigin, getFeedbackDetail);
router.delete('/:id', requireTrustedOrigin, deleteFeedback);
router.patch('/:id/suggestion-workflow', requireTrustedOrigin, updateSuggestionWorkflow);
router.patch('/:id/status', requireTrustedOrigin, updateFeedbackStatus);
router.post('/:id/reply', requireTrustedOrigin, replyToFeedback);

export default router;
