import type { ReactElement, ReactNode } from 'react';

export type LiveCareIconName = 'camera' | 'photos' | 'check' | 'clock' | 'close' | 'chevron';

// Outline icons in the portal's Heroicons style (24px box, 2px round stroke). They replace the
// emoji the page used to draw its own controls with, which rendered differently on every system.
// The activity icons in the timeline bubbles come from the server and stay as they are.
const PATHS: Record<LiveCareIconName, ReactNode> = {
  camera: (
    <>
      <path d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
      <path d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
    </>
  ),
  photos: (
    <path d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 19.5h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25z" />
  ),
  check: <path d="M4.5 12.75l6 6 9-13.5" />,
  clock: <path d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />,
  close: <path d="M6 18L18 6M6 6l12 12" />,
  chevron: <path d="M8.25 4.5l7.5 7.5-7.5 7.5" />,
};

export function LiveCareIcon({
  name,
  className = 'h-4 w-4',
}: {
  name: LiveCareIconName;
  className?: string;
}): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {PATHS[name]}
    </svg>
  );
}
