import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioTranscript } from '../AudioTranscript';

describe('AudioTranscript', () => {
  let playMock: ReturnType<typeof vi.spyOn>;
  let pauseMock: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    playMock = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockImplementation(() => Promise.resolve());
    pauseMock = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('anchors the playback control to the bottom-right of the feedback content', () => {
    const { container } = render(
      <AudioTranscript
        questions={['What did you like?']}
        answers={['The daily updates.']}
        audio_url="https://example.com/feedback.webm"
      />,
    );

    const playButton = screen.getByRole('button', { name: 'Play raw audio' });
    expect(container.querySelector('audio')).toHaveAttribute(
      'src',
      'https://example.com/feedback.webm',
    );
    expect(playButton).toHaveClass('absolute', 'bottom-4', 'right-4', 'h-12', 'w-12');
    expect(playButton.parentElement).toHaveClass('relative', 'w-full', 'pr-20', 'pb-16');
  });

  it('resolves a locally stored recording against the backend origin', () => {
    const { container } = render(
      <AudioTranscript
        transcript="The parent voice feedback."
        audio_url="/uploads/feedback/raw-recording.webm"
      />,
    );

    expect(container.querySelector('audio')).toHaveAttribute(
      'src',
      'http://localhost:3000/uploads/feedback/raw-recording.webm',
    );
  });

  it('keeps the raw audio control when the transcript is unavailable', () => {
    render(<AudioTranscript audio_url="/uploads/feedback/raw-recording.webm" />);

    expect(screen.getByRole('button', { name: 'Play raw audio' })).toBeInTheDocument();
  });

  it('plays and pauses the raw audio with an updated accessible label', () => {
    render(
      <AudioTranscript
        transcript="The parent voice feedback."
        audio_url="https://example.com/feedback.webm"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Play raw audio' }));

    expect(playMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Pause raw audio' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Pause raw audio' }));

    expect(pauseMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Play raw audio' })).toBeInTheDocument();
  });

  it('keeps the content full width when no audio is available', () => {
    const { container } = render(<AudioTranscript transcript="Text-only feedback." />);

    const contentPanel = container.querySelector('.bg-surface-cream');
    expect(contentPanel).toHaveClass('w-full');
    expect(screen.queryByRole('button', { name: 'Play raw audio' })).not.toBeInTheDocument();
  });
});
