import type { ReactElement } from 'react';

interface InquiryListHeaderProps {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
}

export function InquiryListHeader({
  searchQuery,
  onSearchQueryChange,
}: InquiryListHeaderProps): ReactElement {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div>
        <h1 className="type-display">Inquiries</h1>
        <p className="type-meta text-notice-muted">Customer Support conversations.</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-notice-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.75}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="Search conversations…"
            aria-label="Search conversations"
            className="w-56 rounded-lg border border-field-border bg-surface-card py-2 pl-9 pr-3 type-body text-notice-secondary focus:outline-none focus:ring-2 focus:ring-focus/20"
          />
        </div>
        <button
          type="button"
          aria-label="More filters"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-control-border text-notice-secondary transition-colors hover:bg-surface-cream"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.75}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M6 12h12M10 20h4" />
          </svg>
        </button>
      </div>
    </div>
  );
}
