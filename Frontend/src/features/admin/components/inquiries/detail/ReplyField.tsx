import { useState, type ReactElement } from 'react';

interface ReplyFieldProps {
  parentFirstName: string;
  disabled?: boolean;
  onSend: (body: string) => void;
}

export function ReplyField({ parentFirstName, disabled, onSend }: ReplyFieldProps): ReactElement {
  const [draft, setDraft] = useState('');

  const handleSend = (): void => {
    if (disabled || !draft.trim()) return;
    onSend(draft);
    setDraft('');
  };

  return (
    <div className="flex items-center gap-2 px-4 py-3">
      <input
        type="text"
        value={draft}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') handleSend();
        }}
        placeholder={`Reply to ${parentFirstName} as Customer Support…`}
        className="min-w-0 flex-1 rounded-full border border-field-border bg-surface-cream px-4 py-2.5 type-body text-notice-primary placeholder:text-notice-muted focus:outline-none focus:ring-2 focus:ring-focus/20 disabled:opacity-50"
      />
      <button
        type="button"
        aria-label="Send reply"
        disabled={disabled}
        onClick={handleSend}
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-action-dark theme-gradient-action text-on-action-dark transition-colors hover:bg-action-dark-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-6 6m6-6l6 6" />
        </svg>
      </button>
    </div>
  );
}
