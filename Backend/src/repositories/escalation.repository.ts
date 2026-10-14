import { pool } from '../config/database.js';
import type {
  Escalation,
  EscalationSeverity,
  EscalationSource,
  RaiseEscalationInput,
} from '../contracts/escalation.contract.js';

/** Rows of `escalations`; the reference ("PB-...") is added by the service. */

type SqlRunner = Pick<typeof pool, 'query'>;

interface EscalationSqlRow {
  id: string;
  booking_uuid: string | null;
  booking_pets_uuid: string | null;
  pet_name: string | null;
  source: EscalationSource;
  severity: EscalationSeverity;
  summary: string;
  suggested_step: string;
  suggested_reply: string | null;
  parent_message: string | null;
  reply_by: Date;
  created_at: Date;
  late_flagged_at: Date | null;
  resolved_at: Date | null;
  resolved_by: string | null;
  resolution: string | null;
}

export type StoredEscalation = Omit<Escalation, 'reference'>;

const toStored = (row: EscalationSqlRow): StoredEscalation => ({
  id: row.id,
  bookingId: row.booking_uuid,
  bookingPetId: row.booking_pets_uuid,
  petName: row.pet_name,
  source: row.source,
  severity: row.severity,
  summary: row.summary,
  suggestedStep: row.suggested_step,
  suggestedReply: row.suggested_reply,
  parentMessage: row.parent_message,
  replyBy: row.reply_by.toISOString(),
  createdAt: row.created_at.toISOString(),
  lateFlaggedAt: row.late_flagged_at?.toISOString() ?? null,
  resolvedAt: row.resolved_at?.toISOString() ?? null,
  resolvedBy: row.resolved_by,
  resolution: row.resolution,
});

const SELECT = `
  SELECT e.uuid::text AS id, e.booking_uuid::text AS booking_uuid,
         e.booking_pets_uuid::text AS booking_pets_uuid,
         COALESCE(p.name, bp.pet_name) AS pet_name,
         e.source, e.severity, e.summary, e.suggested_step, e.suggested_reply, e.parent_message,
         e.reply_by, e.created_at, e.late_flagged_at, e.resolved_at,
         e.resolved_by::text AS resolved_by, e.resolution
    FROM escalations e
    LEFT JOIN booking_pets bp ON bp.uuid = e.booking_pets_uuid
    LEFT JOIN pets p ON p.uuid = bp.pet_uuid`;

export const insertEscalation = async (
  input: RaiseEscalationInput,
  replyBy: Date,
  runner: SqlRunner = pool,
): Promise<StoredEscalation> => {
  const inserted = await runner.query<{ uuid: string }>(
    `INSERT INTO escalations
       (booking_uuid, booking_pets_uuid, source, severity, summary, suggested_step,
        suggested_reply, parent_message, reply_by)
     VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9::timestamptz)
     RETURNING uuid::text AS uuid`,
    [
      input.bookingId ?? null,
      input.bookingPetId ?? null,
      input.source,
      input.severity,
      input.summary,
      input.suggestedStep,
      input.suggestedReply ?? null,
      input.parentMessage ?? null,
      replyBy,
    ],
  );
  const id = inserted.rows[0]?.uuid;
  if (!id) throw new Error('escalations insert returned no row');
  const stored = await findEscalation(id, runner);
  if (!stored) throw new Error('escalation vanished after insert');
  return stored;
};

export const findEscalation = async (
  id: string,
  runner: SqlRunner = pool,
): Promise<StoredEscalation | null> => {
  const result = await runner.query<EscalationSqlRow>(`${SELECT} WHERE e.uuid = $1::uuid`, [id]);
  const row = result.rows[0];
  return row ? toStored(row) : null;
};
