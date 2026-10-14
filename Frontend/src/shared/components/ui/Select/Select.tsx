import React from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  'onChange' | 'value'
> {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  selectClassName?: string;
  icon?: React.ReactNode;
}

export const Select: React.FC<SelectProps> = ({
  options,
  value,
  onChange,
  className = '',
  selectClassName = '',
  icon,
  ...props
}) => {
  const defaultIcon = (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );

  return (
    <div className={`relative ${className}`}>
      <select
        className={`w-full appearance-none bg-surface-card border border-field-border text-notice-secondary pl-4 pr-10 py-2 rounded-lg type-button hover:bg-surface-cream transition-colors focus:outline-hidden focus:ring-2 focus:ring-focus focus:border-focus cursor-pointer shadow-sm ${selectClassName}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-notice-muted">
        {icon || defaultIcon}
      </div>
    </div>
  );
};
