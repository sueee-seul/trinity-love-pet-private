import { Readable } from 'node:stream';
import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TASK_VIDEO_MAX_BYTES } from '../services/task.media.file.js';
import { jpegBytes, movBytes, mp4Bytes } from './fixtures/task.media.fixtures.js';

// Staff attach photos and short videos on the same route; the bytes decide, and a video is served
// with its own type and with Range answers so a browser can seek.

const TASK_ID = '00000000-0000-4000-8000-000000000101';
const PHOTOS_URL = `/api/tasks/${TASK_ID}/photos`;

const repository = vi.hoisted(() => ({
  findTask: vi.fn(),
  countTaskPhotos: vi.fn(),
  insertTaskPhoto: vi.fn(),
  findTaskPhoto: vi.fn(),
}));
// The object store, in memory: what the bucket holds, read whole or by a byte range as S3 does.
const store = vi.hoisted(() => ({ objects: new Map<string, Buffer>() }));
const objectStorage = vi.hoisted(() => ({
  putObject: vi.fn(async (input: { key: string; body: Buffer }) => {
    store.objects.set(input.key, input.body);
  }),
  deleteObject: vi.fn(),
  getObject: vi.fn(async (key: string, range?: string) => {
    const bytes = store.objects.get(key);
    if (!bytes) throw Object.assign(new Error('missing'), { name: 'NoSuchKey' });
    const match = range ? /^bytes=(\d+)-(\d+)$/.exec(range) : null;
    if (!match) return { Body: Readable.from(bytes), ContentLength: bytes.length };
    const start = Number(match[1]);
    const end = Math.min(Number(match[2]), bytes.length - 1);
    return {
      Body: Readable.from(bytes.subarray(start, end + 1)),
      ContentLength: end - start + 1,
      ContentRange: `bytes ${start}-${end}/${bytes.length}`,
    };
  }),
}));

vi.mock('../config/database.js', () => ({ pool: { query: vi.fn(), connect: vi.fn() } }));
vi.mock('../repositories/task.repository.js', () => repository);
vi.mock('../services/livecare.events.js', () => ({ publishTaskEvent: vi.fn() }));
vi.mock('../services/object.storage.js', () => objectStorage);
// Every task route needs a signed-in employee; this test signs one in for each request.
vi.mock('../common/middlewares/auth.middleware.js', () => {
  const signIn = (req: Request, _res: Response, next: NextFunction): void => {
    req.user = {
      id: 'staff-1',
      email: 'staff@example.test',
      name: 'Sam',
      is_employee: true,
      is_pet_owner: false,
      employee_role: 'staff',
      isUsingTemporaryPassword: false,
    };
    next();
  };
  return { requireAuth: signIn, requireEmployee: signIn, requireManager: signIn };
});

const { taskRouter } = await import('../modules/tasks/task.routes.js');

const createApp = (): express.Express => {
  const app = express();
  app.use('/api', taskRouter);
  return app;
};

/** The extensions of the keys uploads were stored under, in order. */
const storedExtensions = (): string[] =>
  objectStorage.putObject.mock.calls.map(([input]) => input.key.slice(input.key.lastIndexOf('.')));

beforeEach(() => {
  vi.clearAllMocks();
  store.objects.clear();
  repository.findTask.mockResolvedValue({ rows: [{ pet_uuid: 'pet-1' }] });
  repository.countTaskPhotos.mockResolvedValue({ rows: [{ count: 0 }] });
  repository.insertTaskPhoto.mockResolvedValue({ rows: [{ photo_url: 'stored' }] });
});

describe('uploading task media', () => {
  it('stores an MP4 and a MOV under the extension their bytes show', async () => {
    const response = await request(createApp())
      .post(PHOTOS_URL)
      .attach('photos', mp4Bytes(), { filename: 'walk.mp4', contentType: 'video/mp4' })
      .attach('photos', movBytes(), { filename: 'IMG_0002.MOV', contentType: 'video/quicktime' });

    expect(response.status).toBe(201);
    expect(storedExtensions()).toEqual(['.mp4', '.mov']);
    // Kept in the shared object store under tasks/, with the type our own list gives.
    expect(objectStorage.putObject.mock.calls[0]?.[0]).toMatchObject({
      key: expect.stringMatching(/^tasks\/[0-9a-f-]{36}\.mp4$/),
      contentType: 'video/mp4',
    });
  });

  it('rejects an image renamed to a video and stores nothing', async () => {
    const response = await request(createApp())
      .post(PHOTOS_URL)
      .attach('photos', jpegBytes(), { filename: 'walk.mp4', contentType: 'video/mp4' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('This file is not an MP4, MOV or WebM video.');
    expect(objectStorage.putObject).not.toHaveBeenCalled();
  });

  it('rejects a video over 30 MB before reading the rest of it', async () => {
    const response = await request(createApp())
      .post(PHOTOS_URL)
      .attach('photos', mp4Bytes(12, TASK_VIDEO_MAX_BYTES), {
        filename: 'long.mp4',
        contentType: 'video/mp4',
      });

    expect(response.status).toBe(413);
    expect(response.body.error).toBe('A video can be up to 30 MB and a photo up to 10 MB.');
    expect(objectStorage.putObject).not.toHaveBeenCalled();
  });

  it('still accepts a photo', async () => {
    const response = await request(createApp())
      .post(PHOTOS_URL)
      .attach('photos', jpegBytes(), { filename: 'dog.jpg', contentType: 'image/jpeg' });

    expect(response.status).toBe(201);
    expect(storedExtensions()).toEqual(['.jpg']);
  });
});

describe('serving a task video', () => {
  it('answers a Range request with 206, Content-Range and the video type', async () => {
    const bytes = mp4Bytes(12, 1000);
    store.objects.set('tasks/clip.mp4', bytes);
    repository.findTaskPhoto.mockResolvedValue({
      rows: [{ photo_url: 'clip.mp4', caption: 'walk.mp4' }],
    });

    const response = await request(createApp())
      .get(`${PHOTOS_URL}/clip.mp4?inline=1`)
      .set('Range', 'bytes=0-99');

    expect(response.status).toBe(206);
    expect(response.headers['content-range']).toBe(`bytes 0-99/${bytes.length}`);
    expect(response.headers['content-type']).toBe('video/mp4');
    expect(response.headers['accept-ranges']).toBe('bytes');
    expect(response.headers['content-disposition']).toBe('inline; filename="walk.mp4"');
  });

  it('serves a MOV whole as video/quicktime without a Range', async () => {
    store.objects.set('tasks/clip.mov', movBytes());
    repository.findTaskPhoto.mockResolvedValue({
      rows: [{ photo_url: 'clip.mov', caption: 'clip.mov' }],
    });

    const response = await request(createApp()).get(`${PHOTOS_URL}/clip.mov?inline=1`);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('video/quicktime');
  });
  it('serves a photo with its image type for display', async () => {
    store.objects.set('tasks/dog.webp', jpegBytes());
    repository.findTaskPhoto.mockResolvedValue({
      rows: [{ photo_url: 'dog.webp', caption: 'Morning playtime.webp' }],
    });

    const response = await request(createApp()).get(`${PHOTOS_URL}/dog.webp?inline=1`);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('image/webp');
    expect(response.headers['content-disposition']).toBe(
      'inline; filename="Morning playtime.webp"',
    );
  });

  it('answers 404 when the file is not in the store', async () => {
    repository.findTaskPhoto.mockResolvedValue({
      rows: [{ photo_url: 'gone.jpg', caption: 'gone.jpg' }],
    });

    const response = await request(createApp()).get(`${PHOTOS_URL}/gone.jpg?inline=1`);

    expect(response.status).toBe(404);
    expect(response.headers['content-disposition']).toBeUndefined();
  });
});
