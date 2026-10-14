import React from 'react';
import type { DictationStatus } from './useDictation';

/**
 * The microphone control that goes with `useDictation`: press once to start, again to stop.
 *
 * State is shown three ways, never by colour alone - the label, a live dot while listening, and a
 * spinner while the last words are settling - so the control reads the same to a screen reader,
 * in any brand theme, and with reduced motion.
 */

export interface DictationButtonLabels {
  start: string;
  stop: string;
  requesting: string;
  finishing: string;
}

const ENGLISH_LABELS: DictationButtonLabels = {
  start: 'Speak instead of typing',
  stop: 'Stop and add what I said',
  requesting: 'Waiting for microphone permission',
  finishing: 'Adding your words',
};

export interface DictationButtonProps {
  status: DictationStatus;
  onToggle: () => Promise<void>;
  disabled?: boolean;
  labels?: DictationButtonLabels;
  className?: string;
}

const MicrophoneIcon: React.FC = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z" />
    <path d="M19 11a7 7 0 0 1-14 0" />
    <path d="M12 18v3" />
  </svg>
);

const StopIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
    <rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor" />
  </svg>
);

export const DictationButton: React.FC<DictationButtonProps> = ({
  status,
  onToggle,
  disabled = false,
  labels = ENGLISH_LABELS,
  className = '',
}) => {
  const listening = status === 'listening';
  const busy = status === 'requesting' || status === 'finishing';
  const label = listening
    ? labels.stop
    : status === 'requesting'
      ? labels.requesting
      : status === 'finishing'
        ? labels.finishing
        : labels.start;

  return (
    <button
      type="button"
      onClick={() => void onToggle()}
      disabled={disabled || busy}
      aria-pressed={listening}
      aria-label={label}
      title={label}
      className={`relative inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border transition-[background-color,border-color,transform] duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus active:scale-[.96] disabled:cursor-not-allowed disabled:opacity-50 ${
        listening
          ? 'border-status-danger bg-status-danger text-white'
          : 'border-border-soft bg-surface-card text-notice-primary hover:border-control-border hover:bg-surface-cream'
      } ${className}`}
    >
      {listening && (
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full ring-4 ring-status-danger/25 motion-safe:animate-pulse"
        />
      )}
      {busy ? (
        <span
          aria-hidden="true"
          className="h-4 w-4 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin"
        />
      ) : listening ? (
        <StopIcon />
      ) : (
        <MicrophoneIcon />
      )}
    </button>
  );
};
