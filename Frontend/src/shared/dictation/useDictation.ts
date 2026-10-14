import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranscribeStream, type TranscribeStreamDependencies } from './useTranscribeStream';

/**
 * Press-to-talk dictation into a text field, for any form in the app.
 *
 * It owns the microphone: asks for it only when the person presses the button, streams it to the
 * Backend's speech socket for live transcription, and appends the final words to the field's
 * current text (it never sends anything on the person's behalf). A form that also keeps the
 * recording - voice feedback does - passes `onAudioRecorded` and gets the audio as one Blob.
 *
 * Audio is transcribed and discarded by the server; this hook stores nothing either.
 */

export type DictationStatus = 'idle' | 'requesting' | 'listening' | 'finishing';

export type DictationErrorKind = 'unsupported' | 'permission_denied' | 'failed';

export interface DictationError {
  kind: DictationErrorKind;
  message: string;
}

/** What the person reads when voice input cannot be used; English unless a form passes its own. */
export interface DictationMessages {
  unsupported: string;
  permissionDenied: string;
  noMicrophone: string;
  failed: string;
  /** Replaces the speech service's own (English) error text when set. */
  streamFailed?: string;
}

const DEFAULT_MESSAGES: DictationMessages = {
  unsupported: 'This browser does not support voice input. Please type instead.',
  permissionDenied:
    'Microphone access is blocked. You can allow it in your browser’s site settings, or type instead.',
  noMicrophone: 'No microphone was found. Please type instead.',
  failed: 'Voice input could not start. Please type instead.',
};

export interface UseDictationOptions {
  value: string;
  onChange: (text: string) => void;
  onAudioRecorded?: (recording: Blob) => void;
  messages?: Partial<DictationMessages>;
}

export interface DictationDependencies {
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  createRecorder: ((stream: MediaStream) => MediaRecorder) | null;
  transcribe?: TranscribeStreamDependencies;
}

export interface DictationState {
  status: DictationStatus;
  isSupported: boolean;
  /** The field text with the words still being spoken appended, for live display. */
  displayText: string;
  interimText: string;
  error: DictationError | null;
  toggle: () => Promise<void>;
  stop: () => Promise<void>;
}

const MICROPHONE_CONSTRAINTS: MediaStreamConstraints = {
  audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
};

const hasMicrophone = (): boolean =>
  typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function';

const defaultDependencies = (): DictationDependencies => ({
  getUserMedia: (constraints) => navigator.mediaDevices.getUserMedia(constraints),
  createRecorder:
    typeof MediaRecorder === 'undefined'
      ? null
      : (stream): MediaRecorder => new MediaRecorder(stream),
});

/** Joins dictated words to what is already typed, with exactly one space between them. */
export const appendDictation = (current: string, dictated: string): string => {
  const words = dictated.trim();
  if (!words) return current;
  if (!current.trim()) return words;
  return `${current.replace(/\s+$/, '')} ${words}`;
};

const describeMicrophoneError = (error: unknown, messages: DictationMessages): DictationError => {
  const name = error instanceof DOMException || error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return { kind: 'permission_denied', message: messages.permissionDenied };
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return { kind: 'failed', message: messages.noMicrophone };
  }
  return { kind: 'failed', message: messages.failed };
};

const stopTracks = (stream: MediaStream | null): void => {
  stream?.getTracks().forEach((track) => track.stop());
};

export const useDictation = (
  { value, onChange, onAudioRecorded, messages: customMessages }: UseDictationOptions,
  dependencies: DictationDependencies | null = null,
): DictationState => {
  // Resolved once: browser APIs (or test doubles) do not change during a component's life.
  const [resolvedDependencies] = useState(() => dependencies ?? defaultDependencies());
  const transcription = useTranscribeStream(resolvedDependencies.transcribe);
  const [requesting, setRequesting] = useState(false);
  const [microphoneError, setMicrophoneError] = useState<DictationError | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const latest = useRef({ value, onChange, onAudioRecorded, messages: DEFAULT_MESSAGES });

  const isSupported = dependencies !== null || hasMicrophone();
  const messages: DictationMessages = { ...DEFAULT_MESSAGES, ...customMessages };
  const { finalTranscript, reset, isStreaming, isFlushing } = transcription;

  // Declared first so the effects below always see this render's field value and callbacks.
  useEffect(() => {
    latest.current = { value, onChange, onAudioRecorded, messages };
  });

  // The provider settles the final words once, after `stop`; they join the field exactly then.
  useEffect(() => {
    if (!finalTranscript) return;
    latest.current.onChange(appendDictation(latest.current.value, finalTranscript));
    reset();
  }, [finalTranscript, reset]);

  // The microphone is released as soon as the session is over, however it ended.
  useEffect(() => {
    if (!isStreaming && !isFlushing && !requesting && recorderRef.current === null) {
      stopTracks(streamRef.current);
      streamRef.current = null;
    }
  }, [isStreaming, isFlushing, requesting]);

  useEffect(
    () => (): void => {
      recorderRef.current?.stop();
      stopTracks(streamRef.current);
    },
    [],
  );

  const startRecorder = useCallback(
    (stream: MediaStream): void => {
      const create = resolvedDependencies.createRecorder;
      if (!latest.current.onAudioRecorded || !create) return;
      chunksRef.current = [];
      const recorder = create(stream);
      recorder.ondataavailable = (event: BlobEvent): void => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = (): void => {
        recorderRef.current = null;
        const recording = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        chunksRef.current = [];
        if (recording.size > 0) latest.current.onAudioRecorded?.(recording);
        if (!streamRef.current?.active) return;
        stopTracks(streamRef.current);
        streamRef.current = null;
      };
      recorder.start();
      recorderRef.current = recorder;
    },
    [resolvedDependencies],
  );

  const start = useCallback(async (): Promise<void> => {
    if (!isSupported) {
      setMicrophoneError({ kind: 'unsupported', message: latest.current.messages.unsupported });
      return;
    }
    setMicrophoneError(null);
    setRequesting(true);
    let stream: MediaStream;
    try {
      stream = await resolvedDependencies.getUserMedia(MICROPHONE_CONSTRAINTS);
    } catch (error: unknown) {
      setRequesting(false);
      setMicrophoneError(describeMicrophoneError(error, latest.current.messages));
      return;
    }
    streamRef.current = stream;
    try {
      await transcription.start(stream);
      startRecorder(stream);
    } catch {
      // useTranscribeStream has already put a readable message in its own `error`.
      stopTracks(stream);
      streamRef.current = null;
    } finally {
      setRequesting(false);
    }
  }, [isSupported, resolvedDependencies, startRecorder, transcription]);

  const stop = useCallback(async (): Promise<void> => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    await transcription.stop();
  }, [transcription]);

  const toggle = useCallback(async (): Promise<void> => {
    if (isStreaming) {
      await stop();
      return;
    }
    if (!requesting && !isFlushing) {
      await start();
    }
  }, [isStreaming, isFlushing, requesting, start, stop]);

  const status: DictationStatus = requesting
    ? 'requesting'
    : isStreaming
      ? 'listening'
      : isFlushing
        ? 'finishing'
        : 'idle';

  const streamError: DictationError | null = transcription.error
    ? { kind: 'failed', message: messages.streamFailed ?? transcription.error }
    : null;

  return {
    status,
    isSupported,
    displayText:
      status === 'listening' && transcription.interimTranscript
        ? appendDictation(value, transcription.interimTranscript)
        : value,
    interimText: transcription.interimTranscript,
    error: microphoneError ?? streamError,
    toggle,
    stop,
  };
};
