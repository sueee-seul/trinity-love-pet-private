import React from 'react';
import { Link } from 'react-router-dom';
import type { GoogleReviewDashboard } from '../../../types/googleReviewDashboard';

interface ManagerAttentionCardsProps {
  attention: GoogleReviewDashboard['managerAttention'];
}

interface AttentionCardConfig {
  key: keyof GoogleReviewDashboard['managerAttention'];
  label: string;
  description: string;
  tone: 'danger' | 'warning' | 'notice';
  href: string;
}

const GOOGLE_REVIEW_FEEDBACK_PATH = '/admin/feedback?source=google-reviews';

const ATTENTION_CARDS: readonly AttentionCardConfig[] = [
  {
    key: 'issuesNeedReview',
    label: 'Unreplied issues',
    description: 'No successful reply; classified as Issue',
    tone: 'danger',
    href: `${GOOGLE_REVIEW_FEEDBACK_PATH}&status=unreplied&type=issue`,
  },
  {
    key: 'overdueReplies',
    label: 'Overdue replies',
    description: 'No successful reply at 24h+ under the reply SLA',
    tone: 'warning',
    href: `${GOOGLE_REVIEW_FEEDBACK_PATH}&status=unreplied&age=overdue`,
  },
  {
    key: 'approachingThreshold',
    label: 'Reply soon',
    description: 'Within the 24-hour reply SLA, waiting 12h to under 24h',
    tone: 'notice',
    href: `${GOOGLE_REVIEW_FEEDBACK_PATH}&status=unreplied&age=approaching`,
  },
];

const CARD_TONE_CLASSES: Record<AttentionCardConfig['tone'], string> = {
  danger: 'border-status-danger/30 bg-status-danger/5',
  warning: 'border-theme-apricot/60 bg-theme-apricot/10',
  notice: 'border-theme-sun/50 bg-theme-sun/10',
};

const ICON_TONE_CLASSES: Record<AttentionCardConfig['tone'], string> = {
  danger: 'bg-status-danger text-surface-card',
  warning: 'bg-theme-earth text-surface-card',
  notice: 'bg-theme-sun text-on-sun',
};

const AttentionIcon: React.FC<{ tone: AttentionCardConfig['tone'] }> = ({ tone }) => (
  <span
    aria-hidden="true"
    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${ICON_TONE_CLASSES[tone]}`}
  >
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 8v4m0 4h.01M10.3 3.6 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z"
      />
    </svg>
  </span>
);

export const ManagerAttentionCards: React.FC<ManagerAttentionCardsProps> = ({ attention }) => {
  return (
    <section
      aria-labelledby="manager-attention-heading"
      className="rounded-2xl border border-border-soft bg-surface-card p-5 shadow-card sm:p-6"
      data-testid="manager-attention-section"
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 id="manager-attention-heading" className="type-eyebrow text-theme-earth">
          MANAGER ATTENTION
        </h2>
        <span
          className="type-meta text-notice-muted"
          title="Shows reviews without a successful reply in the selected period: Issue reviews, Reply soon (12h to under 24h), and Overdue (24h+). Use each card to open matching reviews; signals may overlap, so do not add the counts."
        >
          Signals may overlap; open matching reviews separately.
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {ATTENTION_CARDS.map((card) => (
          <Link
            key={card.key}
            to={card.href}
            aria-label={`${attention[card.key]} ${card.label}. Open matching Google reviews.`}
            className={`group flex min-h-28 items-center gap-4 rounded-xl border p-4 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${CARD_TONE_CLASSES[card.tone]}`}
          >
            <AttentionIcon tone={card.tone} />
            <div className="min-w-0">
              <p className="type-display type-numeral text-display text-notice-primary">
                {attention[card.key]}
              </p>
              <p className="type-button text-notice-primary">{card.label}</p>
              <p className="mt-1 type-meta text-notice-muted">{card.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
};
