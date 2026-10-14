import type { CareMetricKind } from '../contracts/escalation.contract.js';
import { insertMetricEvent, type NewMetricEvent } from '../repositories/care-metrics.repository.js';

/**
 * Scenario 11 outcome 9 asks for numbers: how fast parents get an answer, how much a person had to
 * step in, whether any dose was missed. Nothing here is on a request path: `recordMetric` never
 * throws. The services that do the work record their own events through it.
 */

export const recordMetric = async (
  kind: CareMetricKind,
  details: Omit<NewMetricEvent, 'kind'> = {},
): Promise<void> => {
  try {
    await insertMetricEvent({ kind, ...details });
  } catch (error: unknown) {
    console.error('[care metrics] event was not recorded', {
      kind,
      error: error instanceof Error ? error.name : 'unknown',
    });
  }
};
