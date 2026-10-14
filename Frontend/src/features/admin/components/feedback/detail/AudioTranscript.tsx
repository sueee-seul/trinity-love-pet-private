import React, { useState, useRef } from 'react';
import { API_BASE_URL } from '../../../../../shared/api';

interface AudioTranscriptProps {
  questions?: string[];
  answers?: string[];
  transcript?: string;
  audio_url?: string;
}

const BACKEND_ORIGIN = new URL(API_BASE_URL).origin;

const resolveAudioUrl = (audioUrl: string): string => {
  if (/^https?:\/\//i.test(audioUrl)) {
    return audioUrl;
  }

  return new URL(audioUrl, `${BACKEND_ORIGIN}/`).toString();
};

export const AudioTranscript: React.FC<AudioTranscriptProps> = ({
  questions,
  answers,
  transcript,
  audio_url,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = (): void => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleEnded = (): void => setIsPlaying(false);

  const hasQA = questions && answers && questions.length > 0 && answers.length > 0;

  if (!hasQA && !transcript && !audio_url) return null;

  return (
    <div className="border border-border-soft rounded-xl p-6 mb-8 shadow-sm">
      <div className="mb-4">
        <h3 className="type-eyebrow text-notice-muted">Detailed Feedback (Questions & Answers)</h3>
      </div>

      {audio_url && (
        <audio
          ref={audioRef}
          src={resolveAudioUrl(audio_url)}
          onEnded={handleEnded}
          className="hidden"
        />
      )}

      <div
        className={`relative w-full rounded-lg border border-border-soft bg-surface-cream p-6 space-y-6 ${audio_url ? 'pr-20 pb-16' : ''}`}
      >
        {hasQA ? (
          questions.map((q, idx) => (
            <div key={`${q}-${answers[idx]}`}>
              <h4 className="type-normal mb-2 whitespace-pre-line leading-relaxed">{q}</h4>
              <p className="type-small text-notice-secondary leading-relaxed italic whitespace-pre-line">
                &quot;{answers[idx]}&quot;
              </p>
            </div>
          ))
        ) : (
          <p className="type-small text-notice-secondary leading-relaxed italic">
            &quot;{transcript}&quot;
          </p>
        )}

        {audio_url && (
          <button
            type="button"
            onClick={togglePlay}
            title={isPlaying ? 'Pause raw audio' : 'Play raw audio'}
            aria-label={isPlaying ? 'Pause raw audio' : 'Play raw audio'}
            className={`absolute bottom-4 right-4 flex h-12 w-12 items-center justify-center rounded-full text-on-action-dark shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-focus ${
              isPlaying
                ? 'animate-pulse bg-action-dark'
                : 'bg-action-dark hover:bg-action-dark-hover'
            }`}
          >
            {isPlaying ? (
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            ) : (
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3C7.03 3 3 7.03 3 12v7c0 1.1.9 2 2 2h2v-8H5v-1c0-3.87 3.13-7 7-7s7 3.13 7 7v1h-2v8h2c1.1 0 2-.9 2-2v-7c0-4.97-4.03-9-9-9z" />
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
