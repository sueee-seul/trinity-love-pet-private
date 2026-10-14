import express from 'express';
import { errorHandler } from '../../common/middlewares/error.middleware.js';
import adminVaccinationRoutes from '../../routes/admin.vaccination.routes.js';
import petparentVaccinationRoutes from '../../routes/petparent.vaccination.routes.js';
import { AUTH_COOKIE_NAME, createSessionToken } from '../../services/auth.session.js';

// Shared by the vaccination route tests. Each test file still mocks the repositories itself
// (vi.mock only applies in the file that calls it), and these routes pick those mocks up.

export const OWNER = {
  id: '00000000-0000-4000-8000-000000000301',
  email: 'owner@example.test',
  username: 'owner.one',
  name: 'Owner One',
  is_employee: false,
  is_pet_owner: true,
  staff_role: null,
};
export const OTHER_OWNER = {
  ...OWNER,
  id: '00000000-0000-4000-8000-000000000302',
  username: 'owner.two',
};
export const EMPLOYEE = {
  ...OWNER,
  id: '00000000-0000-4000-8000-000000000303',
  username: 'staff.one',
  is_employee: true,
  is_pet_owner: false,
  staff_role: 'staff',
};
export const USERS = [OWNER, OTHER_OWNER, EMPLOYEE];

export const BOOKING_PET_ID = '00000000-0000-4000-8000-000000000601';
export const VACCINATION_URL = `/api/petparent/vaccination/${BOOKING_PET_ID}`;
export const STAFF_CERTIFICATE_URL = `/api/admin/vaccination-certificates/${BOOKING_PET_ID}`;
export const PDF = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n');

export const useTestSessionSecret = (): void => {
  process.env.AUTH_SESSION_SECRET = 'petparent-vaccination-route-test-secret';
  process.env.AUTH_SESSION_VERSION = '1';
};

export const createVaccinationApp = (): express.Express => {
  const app = express();
  app.use(express.json());
  app.use('/api/petparent', petparentVaccinationRoutes);
  app.use('/api/admin/vaccination-certificates', adminVaccinationRoutes);
  app.use(errorHandler);
  return app;
};

export const cookieFor = async (user: { id: string }): Promise<string> =>
  `${AUTH_COOKIE_NAME}=${await createSessionToken(user.id)}`;
