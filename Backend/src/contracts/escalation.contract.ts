import type { BookingNotificationSetting } from './booking.notification.contract.js';

/**
 * Something that needs a person (Scenario 11 outcome 8): a dose past its window, a parent message
 * the agent cannot answer with evidence, an incident, a photo that worries the model, or a parent
 * asking for a person. Every escalation carries what happened, what the record shows, a suggested
 * next step and a reply-by time, so the manager who opens it knows what to do first.
 */

export const ESCALATION_SOURCES = [
  'medication_overdue',
  'parent_message',
  'incident',
  'image_flag',
  'support_requested',
  'behaviour_trend',
  'other',
] as const;
export type EscalationSource = (typeof ESCALATION_SOURCES)[number];

export const ESCALATION_SEVERITIES = ['urgent', 'normal'] as const;
export type EscalationSeverity = (typeof ESCALATION_SEVERITIES)[number];

/** The reply-by clock: a person answers an urgent one within 30 minutes, the rest within 2 hours. */
export const REPLY_BY_MINUTES: Readonly<Record<EscalationSeverity, number>> = {
  urgent: 30,
  normal: 120,
};

export interface Escalation {
  id: string;
  bookingId: string | null;
  bookingPetId: string | null;
  /** "PB-ABC123" when the escalation belongs to a booking. */
  reference: string | null;
  petName: string | null;
  source: EscalationSource;
  severity: EscalationSeverity;
  summary: string;
  suggestedStep: string;
  suggestedReply: string | null;
  parentMessage: string | null;
  replyBy: string;
  createdAt: string;
  lateFlaggedAt: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolution: string | null;
}

export interface RaiseEscalationInput {
  bookingId?: string | null;
  bookingPetId?: string | null;
  source: EscalationSource;
  severity: EscalationSeverity;
  /** What happened and what the record shows. Facts only; the parent's words go in `parentMessage`. */
  summary: string;
  suggestedStep: string;
  suggestedReply?: string | null;
  parentMessage?: string | null;
  /** The manager bell setting to write under; the generic escalation setting by default. */
  noticeSetting?: BookingNotificationSetting;
}

/** The events behind Scenario 11 outcome 9. Values: seconds for replies, minutes for resolutions. */
export const CARE_METRIC_KINDS = [
  'parent_message_received',
  'agent_replied',
  'person_replied',
  'escalation_raised',
  'escalation_resolved',
  'escalation_late',
  'dose_overdue',
  'daily_update_sent',
  'arrival_note_sent',
  'stay_report_sent',
  'self_service_change',
  'weekly_report_sent',
] as const;
export type CareMetricKind = (typeof CARE_METRIC_KINDS)[number];
