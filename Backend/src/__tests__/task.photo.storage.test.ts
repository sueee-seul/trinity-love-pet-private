import { Readable } from 'node:stream';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Task photos and videos are kept in the shared object store, so every server sees the same files.

const objectStorage = vi.hoisted(() => ({
  putObject: vi.fn(),
  getObject: vi.fn(),
  deleteObject: vi.fn(),
}));
vi.mock('../services/object.storage.js', () => objectStorage);

const { readTaskMedia, removeTaskPhoto, saveTaskPhoto, taskMediaKey } =
  await import('../services/task.photo.storage.js');

const upload = (originalname: string, bytes = Buffer.from('photo')): Express.Multer.File =>
  ({ buffer: bytes, originalname }) as Express.Multer.File;

describe('task media in the object store', () => {
  beforeEach(() => vi.clearAllMocks());

  it('stores an upload under tasks/ with a random name, its type and a private cache rule', async () => {
    const saved = await saveTaskPhoto(upload('Morning walk.jpg'), '.jpg');

    expect(saved.storedName).toMatch(/^[0-9a-f-]{36}\.jpg$/);
    expect(saved.displayName).toBe('Morning walk.jpg');
    expect(objectStorage.putObject).toHaveBeenCalledWith({
      key: `tasks/${saved.storedName}`,
      body: Buffer.from('photo'),
      contentType: 'image/jpeg',
      cacheControl: 'private, max-age=300',
    });
  });

  it('refuses an empty upload and stores nothing', async () => {
    await expect(saveTaskPhoto(upload('a.jpg', Buffer.alloc(0)), '.jpg')).rejects.toThrow();
    expect(objectStorage.putObject).not.toHaveBeenCalled();
  });

  it('only ever reads our own kind of name, never a path', async () => {
    expect(taskMediaKey('../secret.jpg')).toBeNull();
    expect(taskMediaKey('notes.txt')).toBeNull();
    await expect(readTaskMedia('../secret.jpg')).resolves.toBeNull();
    expect(objectStorage.getObject).not.toHaveBeenCalled();
  });

  it('passes the byte range on and reports a partial answer', async () => {
    objectStorage.getObject.mockResolvedValue({
      Body: Readable.from(Buffer.from('abc')),
      ContentLength: 3,
      ContentRange: 'bytes 0-2/10',
    });

    const media = await readTaskMedia('clip.mp4', 'bytes=0-2');

    expect(objectStorage.getObject).toHaveBeenCalledWith('tasks/clip.mp4', 'bytes=0-2');
    expect(media).toMatchObject({
      contentType: 'video/mp4',
      contentLength: 3,
      contentRange: 'bytes 0-2/10',
    });
  });

  it('treats a missing file as no photo, but an outage as an error', async () => {
    objectStorage.getObject.mockRejectedValueOnce(
      Object.assign(new Error('missing'), { name: 'NoSuchKey' }),
    );
    await expect(readTaskMedia('gone.jpg')).resolves.toBeNull();

    objectStorage.getObject.mockRejectedValueOnce(new Error('storage down'));
    await expect(readTaskMedia('dog.jpg')).rejects.toThrow('storage down');
  });

  it('deletes by the same key', async () => {
    await removeTaskPhoto('dog.jpg');
    expect(objectStorage.deleteObject).toHaveBeenCalledWith('tasks/dog.jpg');
  });
});
