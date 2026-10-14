import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import express, { type NextFunction, type Request, type Response } from 'express';
import profileMediaRoutes from '../routes/profile.media.routes.js';
import { errorHandler } from '../common/middlewares/error.middleware.js';

const service = vi.hoisted(() => ({
  createUploadUrl: vi.fn(),
  removeUpload: vi.fn(),
}));

const user = {
  id: 'owner-1',
  email: 'parent@example.test',
  name: 'Parent',
  is_employee: false,
  is_pet_owner: true,
  employee_role: null,
  isUsingTemporaryPassword: false,
};

vi.mock('../services/profile.media.service.js', () => service);
vi.mock('../common/middlewares/auth.middleware.js', () => ({
  requireAuth: (req: Request, _res: Response, next: NextFunction): void => {
    req.user = user;
    next();
  },
  requireTrustedOrigin: (_req: Request, _res: Response, next: NextFunction): void => next(),
}));

const app = express();
app.use(express.json());
app.use('/api/profile-media', profileMediaRoutes);
app.use(errorHandler);

describe('profile media API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    service.createUploadUrl.mockResolvedValue({
      uploadUrl: 'https://upload.example.test',
      objectKey: 'profile-media/users/owner-1/upload/avatar.png',
      assetUrl: 'https://storage.example.test/petown/profile-media/users/owner-1/upload/avatar.png',
      expiresIn: 300,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400, immutable',
      },
    });
    service.removeUpload.mockResolvedValue(undefined);
  });

  it('accepts image metadata and maps fileName to the storage service contract', async () => {
    const response = await request(app).post('/api/profile-media/upload-url').send({
      target: 'avatar',
      fileName: 'avatar.png',
      contentType: 'image/png',
      size: 12,
    });

    expect(response.status).toBe(200);
    expect(service.createUploadUrl).toHaveBeenCalledWith(user, {
      target: 'avatar',
      originalName: 'avatar.png',
      contentType: 'image/png',
      size: 12,
    });
    expect(response.body.assetUrl).toContain('/profile-media/users/owner-1/');
  });

  it('rejects unsupported content types before the service is called', async () => {
    const response = await request(app).post('/api/profile-media/upload-url').send({
      target: 'avatar',
      fileName: 'avatar.pdf',
      contentType: 'application/pdf',
      size: 12,
    });

    expect(response.status).toBe(400);
    expect(service.createUploadUrl).not.toHaveBeenCalled();
  });

  it('passes cleanup requests through and returns no body', async () => {
    const response = await request(app).delete('/api/profile-media/upload').send({
      target: 'pet-photo',
      objectKey: 'profile-media/pets/owner-1/upload/paws.png',
    });

    expect(response.status).toBe(204);
    expect(service.removeUpload).toHaveBeenCalledWith(
      user,
      'pet-photo',
      'profile-media/pets/owner-1/upload/paws.png',
    );
  });
});
