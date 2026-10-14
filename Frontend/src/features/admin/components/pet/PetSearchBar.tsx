import React from 'react';

interface PetSearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export const PetSearchBar: React.FC<PetSearchBarProps> = ({ value, onChange }) => {
  return (
    <div className="relative mb-6 w-80 max-w-full">
      <svg
        className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-notice-muted"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      <input
        type="text"
        placeholder="Search pets..."
        aria-label="Search pets"
        className="w-full type-body bg-surface-card border border-field-border rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-focus/20 focus:border-focus transition-all text-notice-secondary"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
};
