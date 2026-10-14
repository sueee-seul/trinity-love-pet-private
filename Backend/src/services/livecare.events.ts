import type { Request, Response } from 'express';

// Same shape as conversation.events.ts, keyed by pet_uuid instead of a
// conversation id. Every `tasks`/`media_logs` write for a pet is scoped to
// that pet, and the Live Care dashboard always resolves to one pet.

export const TASK_UPDATED_EVENT = 'task-updated';
export const TASK_SSE_HEARTBEAT_INTERVAL_MS = 25_000;

export interface TaskUpdateEvent {
  type: typeof TASK_UPDATED_EVENT;
  petId: string;
}

export type TaskEventListener = (event: TaskUpdateEvent) => void;

interface TaskSubscription {
  petId: string;
  listener: TaskEventListener;
}

class TaskEventBus {
  private readonly subscriptions = new Set<TaskSubscription>();

  subscribe(petId: string, listener: TaskEventListener): () => void {
    const subscription = { petId, listener };
    this.subscriptions.add(subscription);

    return (): void => {
      this.subscriptions.delete(subscription);
    };
  }

  publish(petId: string): void {
    const event: TaskUpdateEvent = { type: TASK_UPDATED_EVENT, petId };

    for (const subscription of [...this.subscriptions]) {
      if (subscription.petId !== petId) {
        continue;
      }

      try {
        subscription.listener(event);
      } catch (error: unknown) {
        console.error(
          'Task event listener failed',
          error instanceof Error ? error.message : 'Unknown listener error',
        );
      }
    }
  }
}

const taskEventBus = new TaskEventBus();

/** Called after a task or one of its photos is created/updated/deleted, so
 * every open Live Care stream for that pet refreshes. */
export const publishTaskEvent = (petId: string): void => {
  taskEventBus.publish(petId);
};

const formatEvent = (event: TaskUpdateEvent): string =>
  `event: ${TASK_UPDATED_EVENT}\ndata: ${JSON.stringify(event)}\n\n`;

const writeHeartbeat = (res: Response): void => {
  res.write(': heartbeat\n\n');
};

/**
 * Streams a lightweight "something changed" signal for one pet's tasks - no
 * task content travels over the wire, matching the conversation/Google
 * Review SSE pattern: the client reacts by re-fetching over the normal REST
 * endpoint. Callers must already have authorized the request before invoking
 * this.
 */
export const streamTaskEvents = (req: Request, res: Response, petId: string): void => {
  let closed = false;
  let unsubscribe: () => void = () => undefined;

  const cleanup = (): void => {
    if (closed) {
      return;
    }
    closed = true;
    clearInterval(heartbeat);
    unsubscribe();
  };

  const writeEvent = (event: TaskUpdateEvent): void => {
    if (closed || res.writableEnded) {
      cleanup();
      return;
    }
    try {
      res.write(formatEvent(event));
    } catch {
      cleanup();
      if (!res.writableEnded) {
        res.end();
      }
    }
  };

  unsubscribe = taskEventBus.subscribe(petId, writeEvent);
  req.once('close', cleanup);

  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const heartbeat = setInterval(() => {
    if (closed || res.writableEnded) {
      cleanup();
      return;
    }
    try {
      writeHeartbeat(res);
    } catch {
      cleanup();
      if (!res.writableEnded) {
        res.end();
      }
    }
  }, TASK_SSE_HEARTBEAT_INTERVAL_MS);
};
