import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SpeechStreamClientHandlers } from '../speechStreamClient';
import type { SpeechStreamConnection } from '../useTranscribeStream';
import { appendDictation, useDictation, type DictationDependencies } from '../useDictation';

const fakeStream = (): MediaStream => {
  const track = { stop: vi.fn() };
  return { getTracks: () => [track], active: true } as unknown as MediaStream;
};

/** A transcription client whose server events the test fires by hand. */
interface ScriptedTranscription {
  transcribe: NonNullable<DictationDependencies['transcribe']>;
  emitPartial: (text: string) => void;
}

const scriptedTranscription = (): ScriptedTranscription => {
  let handlers: SpeechStreamClientHandlers | null = null;
  const connection: SpeechStreamConnection = {
    connect: vi.fn(async () => undefined),
    sendAudio: vi.fn(),
    stop: vi.fn(() => handlers?.onEnd('two dogs next week', 'stopped')),
    abort: vi.fn(),
  };
  return {
    transcribe: {
      createClient: (next: SpeechStreamClientHandlers): SpeechStreamConnection => {
        handlers = next;
        return connection;
      },
      startCapture: vi.fn(async () => ({ stop: vi.fn(async () => undefined) })),
    },
    emitPartial: (text: string): void => handlers?.onTranscript({ text, isPartial: true }),
  };
};

describe('appendDictation', () => {
  it('joins dictated words with one space', () => {
    expect(appendDictation('Hello  ', ' two dogs ')).toBe('Hello two dogs');
    expect(appendDictation('', 'two dogs')).toBe('two dogs');
    expect(appendDictation('Hello', '   ')).toBe('Hello');
  });
});

describe('useDictation', () => {
  it('appends the final words to the field when dictation stops', async () => {
    const onChange = vi.fn();
    const scripted = scriptedTranscription();
    const dependencies: DictationDependencies = {
      getUserMedia: vi.fn(async () => fakeStream()),
      createRecorder: null,
      transcribe: scripted.transcribe,
    };
    const { result } = renderHook(() => useDictation({ value: 'Hi,', onChange }, dependencies));

    await act(async () => {
      await result.current.toggle();
    });
    expect(result.current.status).toBe('listening');

    act(() => scripted.emitPartial('two dogs'));
    expect(result.current.displayText).toBe('Hi, two dogs');

    await act(async () => {
      await result.current.toggle();
    });
    expect(onChange).toHaveBeenCalledWith('Hi, two dogs next week');
  });

  it('explains a blocked microphone and stays idle', async () => {
    const denied = Object.assign(new Error('denied'), { name: 'NotAllowedError' });
    const dependencies: DictationDependencies = {
      getUserMedia: vi.fn(async () => Promise.reject(denied)),
      createRecorder: null,
      transcribe: scriptedTranscription().transcribe,
    };
    const { result } = renderHook(() =>
      useDictation({ value: '', onChange: vi.fn() }, dependencies),
    );

    await act(async () => {
      await result.current.toggle();
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.error?.kind).toBe('permission_denied');
  });

  // Voice feedback uploads the original recording, so the Blob must reach the form once per stop.
  it('hands the whole recording to onAudioRecorded when dictation stops', async () => {
    const onAudioRecorded = vi.fn();
    const chunk = new Blob(['voice'], { type: 'audio/webm' });
    const recorder = {
      state: 'inactive' as RecordingState,
      mimeType: 'audio/webm',
      ondataavailable: null as ((event: BlobEvent) => void) | null,
      onstop: null as (() => void) | null,
      start(): void {
        this.state = 'recording';
      },
      stop(): void {
        this.state = 'inactive';
        this.ondataavailable?.({ data: chunk } as BlobEvent);
        this.onstop?.();
      },
    };
    const dependencies: DictationDependencies = {
      getUserMedia: vi.fn(async () => fakeStream()),
      createRecorder: () => recorder as unknown as MediaRecorder,
      transcribe: scriptedTranscription().transcribe,
    };
    const { result } = renderHook(() =>
      useDictation({ value: '', onChange: vi.fn(), onAudioRecorded }, dependencies),
    );

    await act(async () => {
      await result.current.toggle();
    });
    await act(async () => {
      await result.current.toggle();
    });

    expect(onAudioRecorded).toHaveBeenCalledTimes(1);
    const recording = onAudioRecorded.mock.calls[0][0] as Blob;
    expect(recording.type).toBe('audio/webm');
    expect(recording.size).toBe(chunk.size);
  });
});
