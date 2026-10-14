import React from 'react';
import { AuthFieldError } from './AuthFieldError';
import type { SignupFieldError } from './signupTypes';

type AvatarKind = 'heart' | 'paw' | 'star' | 'sun';

interface AvatarOption {
  id: string;
  label: string;
  kind: AvatarKind;
  backgroundClassName: string;
}

interface AvatarPickerProps {
  value: string;
  errors?: SignupFieldError[];
  onChange: (avatarId: string) => void;
}

const AVATAR_OPTIONS: readonly AvatarOption[] = [
  { id: 'sunny-paw', label: 'Sunny paw', kind: 'paw', backgroundClassName: 'bg-theme-peach' },
  {
    id: 'happy-heart',
    label: 'Happy heart',
    kind: 'heart',
    backgroundClassName: 'bg-surface-deep',
  },
  { id: 'bright-star', label: 'Bright star', kind: 'star', backgroundClassName: 'bg-theme-honey' },
  { id: 'warm-sun', label: 'Warm sun', kind: 'sun', backgroundClassName: 'bg-surface-bubbles' },
];

const AvatarIcon: React.FC<{ kind: AvatarKind }> = ({ kind }) => {
  if (kind === 'heart') {
    return (
      <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor" aria-hidden="true">
        <path d="M12 20.5 3.8 12.8A5.1 5.1 0 0 1 11 5.6l1 1 1-1a5.1 5.1 0 0 1 7.2 7.2L12 20.5Z" />
      </svg>
    );
  }

  if (kind === 'star') {
    return (
      <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor" aria-hidden="true">
        <path d="m12 2 2.8 6.1 6.7.7-5 4.4 1.5 6.6-6-3.4-6 3.4 1.5-6.6-5-4.4 6.7-.7L12 2Z" />
      </svg>
    );
  }

  if (kind === 'sun') {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-8 w-8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
        <path
          d="M12 2v3M12 19v3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M2 12h3M19 12h3M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor" aria-hidden="true">
      <path d="M8.1 10.5c-1.4 0-2.5-1.2-2.5-2.8S6.7 4.9 8.1 4.9s2.5 1.2 2.5 2.8-1.1 2.8-2.5 2.8Zm7.8 0c-1.4 0-2.5-1.2-2.5-2.8s1.1-2.8 2.5-2.8 2.5 1.2 2.5 2.8-1.1 2.8-2.5 2.8ZM12 20c-3.7 0-6.3-2-6.3-4.8 0-2.6 2.7-4.5 6.3-4.5s6.3 1.9 6.3 4.5C18.3 18 15.7 20 12 20Z" />
    </svg>
  );
};

export const AvatarPicker: React.FC<AvatarPickerProps> = ({ value, errors, onChange }) => {
  return (
    <fieldset>
      <legend className="type-body mb-3 font-bold text-notice-primary">Choose your avatar</legend>
      <div className="grid grid-cols-4 gap-3">
        {AVATAR_OPTIONS.map((option) => {
          const isSelected = value === option.id;

          return (
            <button
              key={option.id}
              type="button"
              aria-label={`Select ${option.label} avatar`}
              aria-pressed={isSelected}
              onClick={() => onChange(option.id)}
              className={`relative flex aspect-square items-center justify-center rounded-2xl border-2 text-theme-earth transition-all hover:-translate-y-0.5 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2 ${option.backgroundClassName} ${isSelected ? 'border-theme-earth shadow-sm ring-2 ring-theme-earth/20' : 'border-transparent'}`}
            >
              <AvatarIcon kind={option.kind} />
              {isSelected && (
                <span
                  className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-theme-earth text-xs text-surface-card"
                  aria-hidden="true"
                >
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>
      {errors?.map((error) => (
        <AuthFieldError key={`avatar-${error.code}`} message={error.message} />
      ))}
    </fieldset>
  );
};
