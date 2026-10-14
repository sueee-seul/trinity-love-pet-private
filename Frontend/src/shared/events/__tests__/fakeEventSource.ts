import { GOOGLE_REVIEWS_SERVER_EVENT } from '../googleReviewServerEvents';

type EventSourceListener = EventListenerOrEventListenerObject;

export class FakeEventSource {
  static instances: FakeEventSource[] = [];

  readonly url: string;
  readonly withCredentials: boolean;
  closed = false;
  private readonly listeners = new Map<string, Set<EventSourceListener>>();

  constructor(url: string, init?: EventSourceInit) {
    this.url = url;
    this.withCredentials = init?.withCredentials ?? false;
    FakeEventSource.instances.push(this);
  }

  static reset(): void {
    FakeEventSource.instances = [];
  }

  addEventListener(type: string, listener: EventSourceListener | null): void {
    if (!listener) {
      return;
    }

    const listeners = this.listeners.get(type) ?? new Set<EventSourceListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: EventSourceListener | null): void {
    if (!listener) {
      return;
    }

    this.listeners.get(type)?.delete(listener);
  }

  close(): void {
    this.closed = true;
  }

  emitOpen(): void {
    this.dispatch('open', new Event('open'));
  }

  emitUpdate(payload: unknown): void {
    this.dispatch(
      GOOGLE_REVIEWS_SERVER_EVENT,
      new MessageEvent(GOOGLE_REVIEWS_SERVER_EVENT, {
        data: JSON.stringify(payload),
      }),
    );
  }

  emitRaw(data: string): void {
    this.dispatch(
      GOOGLE_REVIEWS_SERVER_EVENT,
      new MessageEvent(GOOGLE_REVIEWS_SERVER_EVENT, { data }),
    );
  }

  /** Generic escape hatch for event types not covered by a named `emitX` helper above. */
  emit(type: string, payload: unknown): void {
    this.dispatch(type, new MessageEvent(type, { data: JSON.stringify(payload) }));
  }

  private dispatch(type: string, event: Event): void {
    this.listeners.get(type)?.forEach((listener) => {
      if (typeof listener === 'function') {
        listener(event);
        return;
      }
      listener.handleEvent(event);
    });
  }
}
