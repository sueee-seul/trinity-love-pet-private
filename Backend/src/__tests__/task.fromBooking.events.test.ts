import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PoolClient } from 'pg';

const repository = vi.hoisted(() => ({ deleteTasksForBookingPet: vi.fn() }));
vi.mock('../repositories/task.repository.js', () => repository);

const liveCareEvents = vi.hoisted(() => ({ publishTaskEvent: vi.fn() }));
vi.mock('../services/livecare.events.js', () => liveCareEvents);

import { deleteTasksForBookingPet } from '../services/task.fromBooking.service.js';

// An open Live care page hears when a stay's care plan goes, as it does for any staff change.
describe('deleting a stay care plan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repository.deleteTasksForBookingPet.mockResolvedValue({
      rows: [{ pet_id: 'pet-max' }, { pet_id: 'pet-max' }],
    });
  });

  it('tells live care once for the pet', async () => {
    await deleteTasksForBookingPet('bp-max');

    expect(liveCareEvents.publishTaskEvent).toHaveBeenCalledTimes(1);
    expect(liveCareEvents.publishTaskEvent).toHaveBeenCalledWith('pet-max');
  });

  it('stays quiet inside a transaction, which nobody can see until it commits', async () => {
    await deleteTasksForBookingPet('bp-max', {} as PoolClient);

    expect(liveCareEvents.publishTaskEvent).not.toHaveBeenCalled();
  });
});
