import React from 'react';

interface AIInsightsSummaryProps {
  summary?: string;
  insights?: string[];
}

export const AIInsightsSummary: React.FC<AIInsightsSummaryProps> = ({ summary, insights }) => {
  if ((!insights || insights.length === 0) && !summary) return null;

  return (
    <div className="bg-surface-bubbles/50 border border-control-border rounded-xl p-6 mb-8">
      <div className="flex items-center gap-2 mb-4">
        <svg
          className="w-4 h-4 text-accent-foreground"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
          />
        </svg>
        <h3 className="type-eyebrow text-notice-secondary">AI Insights Summary</h3>
      </div>
      {summary && <p className="type-body mb-4 leading-relaxed text-notice-primary">{summary}</p>}
      {insights && insights.length > 0 && (
        <ul className="space-y-3">
          {insights.map((insight) => (
            <li key={insight} className="flex items-start gap-3">
              <span className="type-eyebrow text-accent-foreground mt-1.5">●</span>
              <span className="type-body leading-relaxed">{insight}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
