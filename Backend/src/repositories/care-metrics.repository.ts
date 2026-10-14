import { pool } from '../config/database.js';
import type { CareMetricKind } from '../contracts/escalation.contract.js';

/** Append-only events in `care_metrics_events`. */

type SqlRunner = Pick<typeof pool, 'query'>;

export interface NewMetricEvent {
  kind: CareMetricKind;
  bookingId?: string | null;
  value?: number | null;
  meta?: Record<string, unknown>;
  occurredAt?: Date;
}

export const insertMetricEvent = async (
  event: NewMetricEvent,
  runner: SqlRunner = pool,
): Promise<void> => {
  await runner.query(
    `INSERT INTO care_metrics_events (kind, booking_uuid, value, meta, occurred_at)
     VALUES ($1, $2::uuid, $3, $4::jsonb, COALESCE($5::timestamptz, now()))`,
    [
      event.kind,
      event.bookingId ?? null,
      event.value ?? null,
      JSON.stringify(event.meta ?? {}),
      event.occurredAt ?? null,
    ],
  );
};
