import { describe, expect, it } from 'vitest';
import type { DayTaskRow } from '../repositories/petparent.livecare.repository.js';
import { countDayMedia, featuredDayMedia } from '../services/daily-summary.media.js';

const task = (id: string, hour: number, media: string[]): DayTaskRow => ({
  id,
  title: 'Playtime',
  status: 'completed',
  scheduled_at: new Date(`2026-12-13T${String(hour).padStart(2, '0')}:00:00Z`),
  description: null,
  photos: media.map((name) => ({ photo_url: name, caption: null })),
});

describe("the update's featured media", () => {
  it('prefers the newest short video of the day over a newer photo', () => {
    const tasks = [
      task('t3', 9, ['late.jpg']),
      task('t1', 1, ['first.mp4']),
      task('t2', 5, ['yard.mov', 'yard.jpg']),
    ];
    expect(featuredDayMedia(tasks)).toEqual({
      kind: 'video',
      path: '/tasks/t2/photos/yard.mov?inline=1',
    });
  });

  it('falls back to the newest photo when the day has no video', () => {
    const tasks = [task('t2', 5, ['b.jpg', 'c.png']), task('t1', 1, ['a.jpg'])];
    expect(featuredDayMedia(tasks)).toEqual({
      kind: 'photo',
      path: '/tasks/t2/photos/c.png?inline=1',
    });
  });

  it('carries nothing when the day has no media', () => {
    expect(featuredDayMedia([task('t1', 1, [])])).toBeNull();
    expect(featuredDayMedia([])).toBeNull();
  });

  it('counts photos and videos apart', () => {
    expect(countDayMedia([task('t1', 1, ['a.jpg', 'b.mp4']), task('t2', 2, ['c.webm'])])).toEqual({
      photos: 1,
      videos: 2,
    });
  });
});
