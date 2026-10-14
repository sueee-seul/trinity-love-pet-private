import type { DayTaskRow } from '../repositories/petparent.livecare.repository.js';
import { taskMediaKindOf, taskMediaPath, type TaskMediaKind } from './task.media.js';

/**
 * The one photo or short video a daily update or an arrival note carries. A clip shows the pet
 * moving and is what parents ask for most, so the newest video of the day wins; otherwise the
 * newest photo, the one most likely to show the pet as it is now. Pure, so it is tested without a
 * database.
 */

export interface FeaturedMedia {
  kind: TaskMediaKind;
  /** `/tasks/:id/photos/:name?inline=1`, stored with the update as its photo path. */
  path: string;
}

/** Every media item of the day, oldest first: tasks by time, then each task's uploads in order. */
const dayMediaOldestFirst = (tasks: DayTaskRow[]): FeaturedMedia[] =>
  [...tasks]
    .sort((left, right) => left.scheduled_at.getTime() - right.scheduled_at.getTime())
    .flatMap((task) =>
      task.photos.map((media) => ({
        kind: taskMediaKindOf(media.photo_url),
        path: taskMediaPath(task.id, media.photo_url),
      })),
    );

export const featuredDayMedia = (tasks: DayTaskRow[]): FeaturedMedia | null => {
  const media = dayMediaOldestFirst(tasks);
  return (
    media.findLast((item) => item.kind === 'video') ??
    media.findLast((item) => item.kind === 'photo') ??
    null
  );
};

/** How many photos and videos the day's tasks carry, counted apart for the update's words. */
export const countDayMedia = (tasks: DayTaskRow[]): { photos: number; videos: number } => {
  const kinds = tasks.flatMap((task) =>
    task.photos.map((media) => taskMediaKindOf(media.photo_url)),
  );
  const videos = kinds.filter((kind) => kind === 'video').length;
  return { photos: kinds.length - videos, videos };
};
