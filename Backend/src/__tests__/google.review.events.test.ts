import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  GoogleReviewEventBus,
  type GoogleReviewInvalidationEvent,
} from '../services/google.review.events.js';

describe('GoogleReviewEventBus', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('filters events by publication target and place slug', () => {
    const bus = new GoogleReviewEventBus();
    const adminListener = vi.fn<(event: GoogleReviewInvalidationEvent) => void>();
    const publicListener = vi.fn<(event: GoogleReviewInvalidationEvent) => void>();
    const otherPlaceListener = vi.fn<(event: GoogleReviewInvalidationEvent) => void>();
    bus.subscribe('admin', 'PetHouse', adminListener);
    bus.subscribe('public', 'PetHouse', publicListener);
    bus.subscribe('both', 'OtherPlace', otherPlaceListener);

    bus.publish({ target: 'admin', placeSlug: 'PetHouse', changeType: 'assigned' });

    expect(adminListener).toHaveBeenCalledOnce();
    expect(publicListener).not.toHaveBeenCalled();
    expect(otherPlaceListener).not.toHaveBeenCalled();
    expect(adminListener).toHaveBeenCalledWith({
      type: 'google-reviews-updated',
      placeSlug: 'PetHouse',
      changeType: 'assigned',
    });

    bus.publish({ target: 'both', placeSlug: 'PetHouse', changeType: 'replied' });

    expect(adminListener).toHaveBeenCalledTimes(2);
    expect(publicListener).toHaveBeenCalledOnce();
    expect(otherPlaceListener).not.toHaveBeenCalled();
  });

  it('stops delivering to an unsubscribed listener', () => {
    const bus = new GoogleReviewEventBus();
    const listener = vi.fn<(event: GoogleReviewInvalidationEvent) => void>();
    const unsubscribe = bus.subscribe('public', 'PetHouse', listener);

    bus.publish({ target: 'both', placeSlug: 'PetHouse', changeType: 'created' });
    unsubscribe();
    bus.publish({ target: 'both', placeSlug: 'PetHouse', changeType: 'deleted' });

    expect(listener).toHaveBeenCalledOnce();
  });

  it('isolates listener failures without throwing or skipping later listeners', () => {
    const bus = new GoogleReviewEventBus();
    const failedListener = vi.fn(() => {
      throw new Error('stream write failed');
    });
    const healthyListener = vi.fn<(event: GoogleReviewInvalidationEvent) => void>();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    bus.subscribe('public', 'PetHouse', failedListener);
    bus.subscribe('public', 'PetHouse', healthyListener);

    expect(() =>
      bus.publish({ target: 'public', placeSlug: 'PetHouse', changeType: 'replied' }),
    ).not.toThrow();
    expect(healthyListener).toHaveBeenCalledOnce();
    expect(consoleError).toHaveBeenCalledWith(
      'Google review event listener failed',
      'stream write failed',
    );
  });
});
