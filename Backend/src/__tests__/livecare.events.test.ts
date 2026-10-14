import { EventEmitter } from 'node:events';
import type { Request, Response } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';

const repository = vi.hoisted(() => ({
  findTask: vi.fn(),
  countTaskPhotos: vi.fn(),
  insertTaskPhoto: vi.fn(),
}));
vi.mock('../repositories/task.repository.js', () => repository);

const storage = vi.hoisted(() => ({ saveTaskPhoto: vi.fn(), removeTaskPhoto: vi.fn() }));
vi.mock('../services/task.photo.storage.js', () => storage);

import { streamTaskEvents } from '../services/livecare.events.js';
import { addTaskPhotos } from '../services/task.photo.service.js';

/** An open Live care stream for one pet, recording what the server writes to it. */
const openStream = (petId: string): { written: string[]; close: () => void } => {
  const request = new EventEmitter();
  const written: string[] = [];
  const response = {
    writableEnded: false,
    status: vi.fn(),
    setHeader: vi.fn(),
    flushHeaders: vi.fn(),
    write: vi.fn((chunk: string) => written.push(chunk)),
    end: vi.fn(),
  };
  streamTaskEvents(request as unknown as Request, response as unknown as Response, petId);
  return { written, close: () => request.emit('close') };
};

// What a staff member does on the task pages reaches the parent's open page straight away.
describe('live care stream', () => {
  const streams: { close: () => void }[] = [];
  afterEach(() => streams.splice(0).forEach((stream) => stream.close()));

  it('tells the pet parent page when staff upload a photo, and only for that pet', async () => {
    const max = openStream('pet-max');
    const luna = openStream('pet-luna');
    streams.push(max, luna);
    repository.findTask.mockResolvedValue({ rows: [{ pet_uuid: 'pet-max' }] });
    repository.countTaskPhotos.mockResolvedValue({ rows: [{ count: '0' }] });
    repository.insertTaskPhoto.mockResolvedValue({ rows: [{ uuid: 'photo-1' }] });
    storage.saveTaskPhoto.mockResolvedValue({ storedName: 'a.jpg', displayName: 'a.jpg' });

    await addTaskPhotos('task-1', [{ file: {} as Express.Multer.File, extension: '.jpg' }]);

    expect(max.written).toEqual([
      'event: task-updated\ndata: {"type":"task-updated","petId":"pet-max"}\n\n',
    ]);
    expect(luna.written).toEqual([]);
  });
});
