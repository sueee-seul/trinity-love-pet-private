import type { ReviewerProfile } from '../services/reviewer.service.js';

declare global {
  namespace Express {
    interface Request {
      reviewer?: ReviewerProfile;
    }
  }
}

export {};
