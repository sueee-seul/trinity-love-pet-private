import React from 'react';

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: React.ReactNode;
  hasNotification?: boolean;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  onOptionClick?: (value: T) => void; // Optional callback for click events even if value is the same
}

export const SegmentedControl = <T extends string>({
  options,
  value,
  onChange,
  onOptionClick,
}: SegmentedControlProps<T>): React.ReactElement => {
  return (
    <div className="flex bg-surface-cream p-1 rounded-full border border-border-soft">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`px-4 py-1.5 rounded-full type-button transition-colors relative ${
            value === option.value
              ? 'bg-action-dark text-on-action-dark shadow-sm'
              : 'text-notice-secondary hover:text-notice-primary'
          }`}
          onClick={() => {
            if (value !== option.value) {
              onChange(option.value);
            }
            if (onOptionClick) {
              onOptionClick(option.value);
            }
          }}
        >
          {option.label}
          {option.hasNotification && (
            <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-status-danger rounded-full" />
          )}
        </button>
      ))}
    </div>
  );
};
