import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as googleReviewDashboardApi from '../../api/googleReviewDashboardApi';
import { resetGoogleReviewStore } from '../../store/googleReviewStore';
import type { GoogleReviewDashboard } from '../../types/googleReviewDashboard';
import { useAdminGoogleReviewDashboard } from '../useAdminGoogleReviewDashboard';

const dashboard = {} as GoogleReviewDashboard;

describe('useAdminGoogleReviewDashboard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetGoogleReviewStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetGoogleReviewStore();
  });

  it('loads dashboard metrics and exposes refresh without a summary request', async () => {
    const fetchDashboard = vi
      .spyOn(googleReviewDashboardApi, 'fetchGoogleReviewDashboard')
      .mockResolvedValue(dashboard);
    const { result } = renderHook(() => useAdminGoogleReviewDashboard());

    await waitFor(() => expect(result.current.dashboard).toBe(dashboard));
    expect(result.current.status).toBe('ready');
    expect(fetchDashboard).toHaveBeenCalledOnce();
    expect(result.current).not.toHaveProperty('summary');
  });
});
