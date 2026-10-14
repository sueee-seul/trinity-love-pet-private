import { useCallback, useEffect, useRef, useState } from 'react';
import { useSiteCopy } from '../../i18n/siteLanguage';
import { ACCESSIBILITY_COPY, type AccessibilityCopy } from '../accessibilityCopy';
import { MIN_SPOKEN_SEGMENT_LENGTH, SENTENCE_SPLIT_PATTERN } from '../constants';

export type SpeechStatus = 'idle' | 'playing' | 'paused';

interface SpeechReader {
  isSupported: boolean;
  status: SpeechStatus;
  currentSegment: string;
  toggle: () => void;
  stop: () => void;
  goToPrevious: () => void;
  goToNext: () => void;
}

const toSegments = (text: string): string[] =>
  text
    .split(/\n+/)
    .flatMap((line) => line.split(SENTENCE_SPLIT_PATTERN))
    .map((segment) => segment.trim())
    .filter((segment) => segment.length >= MIN_SPOKEN_SEGMENT_LENGTH);

/** `innerText` falls back to raw markup order on a hidden element, so only laid-out ones count. */
const isRendered = (element: Element): boolean => element.getClientRects().length > 0;

/**
 * The top bar, read after the page. A sighted visitor takes the chrome in at a glance; someone
 * listening has to be told it is there, which is why the pass is announced before it starts.
 */
const collectNavigationSegments = (speech: AccessibilityCopy['speech']): string[] => {
  const header = Array.from(document.querySelectorAll('header')).find(isRendered);
  if (!header) {
    return [];
  }

  const segments = [speech.navigationPreamble, ...toSegments(header.innerText ?? '')];

  // The account menu is normally closed, so its items are not in the DOM to be read. When it does
  // happen to be open the real items are used; otherwise the hint names what opening it reveals.
  const openMenu = document.querySelector<HTMLElement>('[role="menu"]');
  if (openMenu && isRendered(openMenu)) {
    segments.push(speech.accountMenuOpen, ...toSegments(openMenu.innerText ?? ''));
  } else if (header.querySelector('[aria-haspopup="menu"]')) {
    segments.push(speech.accountMenuHint);
  }

  return segments;
};

/**
 * Text of the page as the visitor sees it. `<main>` is preferred over the whole app so the reader
 * starts on page content rather than re-reading the navigation first; the navigation is appended at
 * the end instead.
 */
const collectReadableSegments = (speech: AccessibilityCopy['speech']): string[] => {
  const source = document.querySelector<HTMLElement>('main') ?? document.getElementById('root');

  return [...toSegments(source?.innerText ?? ''), ...collectNavigationSegments(speech)];
};

export const useSpeechReader = (): SpeechReader => {
  const [isSupported] = useState(
    () => typeof window !== 'undefined' && 'speechSynthesis' in window,
  );
  const { speech } = useSiteCopy(ACCESSIBILITY_COPY);
  const [status, setStatus] = useState<SpeechStatus>('idle');
  const [currentSegment, setCurrentSegment] = useState('');

  const segmentsRef = useRef<string[]>([]);
  const indexRef = useRef(0);
  // Advancing to the next segment happens in `onend`, which also fires when we cancel a segment
  // on purpose (skip, stop). The flag tells those two cases apart.
  const isInterruptingRef = useRef(false);

  // Named function expression so the recursive advance refers to itself rather than to the
  // `speakFrom` binding, which is still being initialised while the callback is created.
  const speakFrom = useCallback(function speakSegment(index: number): void {
    const segments = segmentsRef.current;
    if (index < 0 || index >= segments.length) {
      setStatus('idle');
      setCurrentSegment('');
      return;
    }

    indexRef.current = index;
    setCurrentSegment(segments[index]);

    const utterance = new SpeechSynthesisUtterance(segments[index]);
    utterance.lang = document.documentElement.lang || 'en-NZ';
    utterance.onend = (): void => {
      if (isInterruptingRef.current) {
        isInterruptingRef.current = false;
        return;
      }
      speakSegment(indexRef.current + 1);
    };

    isInterruptingRef.current = true;
    window.speechSynthesis.cancel();
    isInterruptingRef.current = false;
    window.speechSynthesis.speak(utterance);
    setStatus('playing');
  }, []);

  const stop = useCallback(() => {
    if (!isSupported) {
      return;
    }
    isInterruptingRef.current = true;
    window.speechSynthesis.cancel();
    isInterruptingRef.current = false;
    indexRef.current = 0;
    segmentsRef.current = [];
    setStatus('idle');
    setCurrentSegment('');
  }, [isSupported]);

  const toggle = useCallback(() => {
    if (!isSupported) {
      return;
    }

    if (status === 'playing') {
      window.speechSynthesis.pause();
      setStatus('paused');
      return;
    }

    if (status === 'paused') {
      window.speechSynthesis.resume();
      setStatus('playing');
      return;
    }

    segmentsRef.current = collectReadableSegments(speech);
    if (segmentsRef.current.length === 0) {
      return;
    }
    speakFrom(0);
  }, [isSupported, speakFrom, speech, status]);

  const skip = useCallback(
    (direction: 1 | -1) => {
      if (!isSupported || segmentsRef.current.length === 0) {
        return;
      }
      speakFrom(indexRef.current + direction);
    },
    [isSupported, speakFrom],
  );

  const goToPrevious = useCallback(() => skip(-1), [skip]);
  const goToNext = useCallback(() => skip(1), [skip]);

  // Speech keeps running after the component unmounts or the tab navigates away, so it has to be
  // cancelled explicitly rather than left to garbage collection.
  useEffect(() => {
    if (!isSupported) {
      return undefined;
    }
    return (): void => {
      window.speechSynthesis.cancel();
    };
  }, [isSupported]);

  return { isSupported, status, currentSegment, toggle, stop, goToPrevious, goToNext };
};
