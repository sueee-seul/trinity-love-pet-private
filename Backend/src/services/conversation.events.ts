import type { Request, Response } from 'express';

export const CONVERSATION_UPDATED_EVENT = 'conversation-updated';
export const CONVERSATION_SSE_HEARTBEAT_INTERVAL_MS = 25_000;

export interface ConversationUpdateEvent {
  type: typeof CONVERSATION_UPDATED_EVENT;
  conversationId: string;
}

export type ConversationEventListener = (event: ConversationUpdateEvent) => void;

interface ConversationSubscription {
  conversationId: string;
  listener: ConversationEventListener;
}

class ConversationEventBus {
  private readonly subscriptions = new Set<ConversationSubscription>();

  subscribe(conversationId: string, listener: ConversationEventListener): () => void {
    const subscription = { conversationId, listener };
    this.subscriptions.add(subscription);

    return (): void => {
      this.subscriptions.delete(subscription);
    };
  }

  publish(conversationId: string): void {
    const event: ConversationUpdateEvent = { type: CONVERSATION_UPDATED_EVENT, conversationId };

    for (const subscription of [...this.subscriptions]) {
      if (subscription.conversationId !== conversationId) {
        continue;
      }

      try {
        subscription.listener(event);
      } catch (error: unknown) {
        console.error(
          'Conversation event listener failed',
          error instanceof Error ? error.message : 'Unknown listener error',
        );
      }
    }
  }
}

const conversationEventBus = new ConversationEventBus();

/** Called after a message is persisted, so every open stream for that conversation refreshes. */
export const publishConversationEvent = (conversationId: string): void => {
  conversationEventBus.publish(conversationId);
};

const writeHeartbeat = (res: Response): void => {
  res.write(': heartbeat\n\n');
};

/**
 * Runs one long-lived SSE response: writes the opening headers, relays
 * whatever `subscribe` hands it (already formatted as an SSE frame) until the
 * client disconnects, and keeps the connection alive with a heartbeat in
 * between. Shared by every event stream below so each only has to describe
 * its own event shape and how to subscribe to it.
 */
const runSseStream = (
  req: Request,
  res: Response,
  subscribe: (write: (frame: string) => void) => () => void,
): void => {
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

  const write = (frame: string): void => {
    if (closed || res.writableEnded) {
      cleanup();
      return;
    }
    try {
      res.write(frame);
    } catch {
      cleanup();
      if (!res.writableEnded) {
        res.end();
      }
    }
  };

  unsubscribe = subscribe(write);
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
  }, CONVERSATION_SSE_HEARTBEAT_INTERVAL_MS);
};

const formatEvent = (event: ConversationUpdateEvent): string =>
  `event: ${CONVERSATION_UPDATED_EVENT}\ndata: ${JSON.stringify(event)}\n\n`;

/**
 * Streams a lightweight "something changed" signal for one conversation - no
 * message content travels over the wire here, matching the Google Review SSE
 * pattern: the client reacts by re-fetching over the normal REST endpoint.
 * Callers must already have authorized the request before invoking this.
 */
export const streamConversationEvents = (
  req: Request,
  res: Response,
  conversationId: string,
): void => {
  runSseStream(req, res, (write) =>
    conversationEventBus.subscribe(conversationId, (event) => write(formatEvent(event))),
  );
};

export const INQUIRY_CREATED_EVENT = 'inquiry-created';

export interface InquiryCreatedEvent {
  type: typeof INQUIRY_CREATED_EVENT;
  conversationId: string;
}

export type InquiryCreatedListener = (event: InquiryCreatedEvent) => void;

/** Broadcasts to every connected admin/employee, unlike `ConversationEventBus` which targets one conversation's subscribers. */
class InquiryCreatedEventBus {
  private readonly listeners = new Set<InquiryCreatedListener>();

  subscribe(listener: InquiryCreatedListener): () => void {
    this.listeners.add(listener);
    return (): void => {
      this.listeners.delete(listener);
    };
  }

  publish(conversationId: string): void {
    const event: InquiryCreatedEvent = { type: INQUIRY_CREATED_EVENT, conversationId };
    for (const listener of [...this.listeners]) {
      try {
        listener(event);
      } catch (error: unknown) {
        console.error(
          'Inquiry created event listener failed',
          error instanceof Error ? error.message : 'Unknown listener error',
        );
      }
    }
  }
}

const inquiryCreatedEventBus = new InquiryCreatedEventBus();

/** Called once a pet parent's conversation is first persisted, so every open Inquiries list picks it up without a refresh. */
export const publishInquiryCreated = (conversationId: string): void => {
  inquiryCreatedEventBus.publish(conversationId);
};

const formatInquiryCreatedEvent = (event: InquiryCreatedEvent): string =>
  `event: ${INQUIRY_CREATED_EVENT}\ndata: ${JSON.stringify(event)}\n\n`;

/**
 * Streams "a new inquiry was created" to every connected employee - unscoped
 * to any one conversation, since every viewer of the Inquiries list needs it.
 * As with `streamConversationEvents`, only the id travels over the wire; the
 * client re-fetches that one inquiry over the normal REST endpoint.
 */
export const streamInquiryCreatedEvents = (req: Request, res: Response): void => {
  runSseStream(req, res, (write) =>
    inquiryCreatedEventBus.subscribe((event) => write(formatInquiryCreatedEvent(event))),
  );
};
