export const GOOGLE_REVIEW_UPDATED_EVENT = 'google-reviews-updated';

export type GoogleReviewEventTarget = 'admin' | 'public' | 'both';
export type GoogleReviewChangeType =
  'created' | 'assigned' | 'replied' | 'triage_updated' | 'deleted';

export interface GoogleReviewInvalidationEvent {
  type: typeof GOOGLE_REVIEW_UPDATED_EVENT;
  placeSlug: string;
  changeType: GoogleReviewChangeType;
}

export interface GoogleReviewEventPublication {
  target: GoogleReviewEventTarget;
  placeSlug: string;
  changeType: GoogleReviewChangeType;
}

export type GoogleReviewEventListener = (event: GoogleReviewInvalidationEvent) => void;

interface GoogleReviewSubscription {
  target: GoogleReviewEventTarget;
  placeSlug: string;
  listener: GoogleReviewEventListener;
}

const targetsOverlap = (
  subscriberTarget: GoogleReviewEventTarget,
  publicationTarget: GoogleReviewEventTarget,
): boolean => {
  return (
    subscriberTarget === 'both' ||
    publicationTarget === 'both' ||
    subscriberTarget === publicationTarget
  );
};

export class GoogleReviewEventBus {
  private readonly subscriptions = new Set<GoogleReviewSubscription>();

  subscribe(
    target: GoogleReviewEventTarget,
    placeSlug: string,
    listener: GoogleReviewEventListener,
  ): () => void {
    const subscription = { target, placeSlug, listener };
    this.subscriptions.add(subscription);

    return (): void => {
      this.subscriptions.delete(subscription);
    };
  }

  publish(publication: GoogleReviewEventPublication): void {
    const event: GoogleReviewInvalidationEvent = {
      type: GOOGLE_REVIEW_UPDATED_EVENT,
      placeSlug: publication.placeSlug,
      changeType: publication.changeType,
    };

    for (const subscription of [...this.subscriptions]) {
      if (
        subscription.placeSlug !== publication.placeSlug ||
        !targetsOverlap(subscription.target, publication.target)
      ) {
        continue;
      }

      try {
        subscription.listener(event);
      } catch (error: unknown) {
        console.error(
          'Google review event listener failed',
          error instanceof Error ? error.message : 'Unknown listener error',
        );
      }
    }
  }
}

export const googleReviewEventBus = new GoogleReviewEventBus();

export const subscribeToGoogleReviewEvents = (
  target: GoogleReviewEventTarget,
  placeSlug: string,
  listener: GoogleReviewEventListener,
): (() => void) => googleReviewEventBus.subscribe(target, placeSlug, listener);

export const publishGoogleReviewEvent = (publication: GoogleReviewEventPublication): void => {
  googleReviewEventBus.publish(publication);
};
