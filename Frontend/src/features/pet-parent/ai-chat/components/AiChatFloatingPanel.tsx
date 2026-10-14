import type { ReactElement } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePortalCopy } from '../../i18n/portalLocale';
import { CHAT_COPY } from '../chatCopy';
import { AI_CHAT_PAGE_PATH, hidesFloatingChat } from '../chatRoutes';
import { useAiChatStore } from '../store';
import type { Conversation } from '../types';
import { ConversationArea } from './ConversationArea';

/*
 * Bottom right, above the phone tab bar (3rem, a 1rem gap and the home indicator) and 1.5rem off
 * the corner from `md`, where there is no tab bar. The width and height caps keep the panel on a
 * small screen, clear of the 4rem phone header or 5rem desktop header with a 1rem gap.
 *
 * z-30 keeps it under the sticky headers (z-40). The account menu and the notifications open
 * inside a header, so a higher panel would cover them and hide "Log out" while chat is open.
 */
const PANEL_POSITION =
  'fixed bottom-[calc(4rem_+_env(safe-area-inset-bottom))] right-4 z-30 max-w-[calc(100vw-2rem)] md:bottom-6 md:right-6';

const PANEL_SURFACE = 'rounded-2xl border border-border-soft bg-surface-card shadow-card';

// 44px on a phone, where a finger has to hit it, and the old 36px from `md`.
const ICON_BUTTON_SHAPE =
  'flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus md:h-9 md:w-9';
const ICON_BUTTON = `${ICON_BUTTON_SHAPE} text-notice-muted hover:bg-surface-cream`;
const EXPAND_BUTTON = `${ICON_BUTTON_SHAPE} bg-surface-bubbles text-accent-foreground hover:bg-surface-deep`;

const EXPAND_ICON =
  'M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4';
const CLOSE_ICON = 'M6 18L18 6M6 6l12 12';
const MINIMISE_ICON = 'M5 12h14';
const SPARKLE_ICON =
  'M12 3v4m0 10v4m9-9h-4M7 12H3m14.657-6.657l-2.829 2.829M9.172 14.828l-2.829 2.829m0-11.314l2.829 2.829m5.656 5.656l2.829 2.829';

function StrokeIcon({ path }: { path: string }): ReactElement {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  );
}

function MinimizedBar({
  current,
  onExpand,
  onClose,
}: {
  current: Conversation | null;
  onExpand: () => void;
  onClose: () => void;
}): ReactElement {
  const copy = usePortalCopy(CHAT_COPY);
  return (
    <div className={`${PANEL_POSITION} ${PANEL_SURFACE} flex w-[300px] flex-col gap-1 p-3`}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onExpand}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left"
          aria-label={copy.expandChat}
        >
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-surface-bubbles text-accent-foreground">
            <StrokeIcon path={SPARKLE_ICON} />
          </span>
          <span className="type-body truncate font-bold">{copy.assistantName}</span>
        </button>
        <button
          type="button"
          aria-label={copy.expandPanel}
          onClick={onExpand}
          className={ICON_BUTTON}
        >
          <StrokeIcon path={EXPAND_ICON} />
        </button>
        <button type="button" aria-label={copy.close} onClick={onClose} className={ICON_BUTTON}>
          <StrokeIcon path={CLOSE_ICON} />
        </button>
      </div>
      {current && (
        <p className="type-meta m-0 flex items-center gap-1.5 truncate pl-10">
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-status-success"
          />
          {copy.activeStatus(current.petName)}
        </p>
      )}
    </div>
  );
}

export function AiChatFloatingPanel(): ReactElement | null {
  const copy = usePortalCopy(CHAT_COPY);
  const navigate = useNavigate();
  const location = useLocation();
  const isPanelOpen = useAiChatStore((state) => state.isPanelOpen);
  const isPanelMinimized = useAiChatStore((state) => state.isPanelMinimized);
  const closePanel = useAiChatStore((state) => state.closePanel);
  const minimizePanel = useAiChatStore((state) => state.minimizePanel);
  const expandPanel = useAiChatStore((state) => state.expandPanel);
  const current = useAiChatStore((state) => state.activeConversation());
  const startNewConversation = useAiChatStore((state) => state.startNewConversation);
  const sendMessage = useAiChatStore((state) => state.sendMessage);
  const requestSupport = useAiChatStore((state) => state.requestSupport);
  const closeConversation = useAiChatStore((state) => state.closeConversation);

  // Hidden, not closed: the panel comes back as it was once the parent leaves these pages.
  if (!isPanelOpen || hidesFloatingChat(location.pathname)) {
    return null;
  }

  const handleExpandToPage = (): void => {
    closePanel();
    navigate(AI_CHAT_PAGE_PATH);
  };

  if (isPanelMinimized) {
    return <MinimizedBar current={current} onExpand={expandPanel} onClose={closePanel} />;
  }

  return (
    <section
      aria-label={copy.panelLabel}
      className={`${PANEL_POSITION} ${PANEL_SURFACE} flex h-[600px] max-h-[calc(100dvh_-_9rem_-_env(safe-area-inset-bottom))] w-[380px] flex-col overflow-hidden md:max-h-[calc(100dvh_-_7.5rem)]`}
    >
      <div className="flex items-center justify-end gap-1 border-b border-border-soft px-3 py-2">
        <button
          type="button"
          aria-label={copy.minimise}
          onClick={minimizePanel}
          className={ICON_BUTTON}
        >
          <StrokeIcon path={MINIMISE_ICON} />
        </button>
        <button
          type="button"
          aria-label={copy.expandToPage}
          onClick={handleExpandToPage}
          className={EXPAND_BUTTON}
        >
          <StrokeIcon path={EXPAND_ICON} />
        </button>
        <button type="button" aria-label={copy.close} onClick={closePanel} className={ICON_BUTTON}>
          <StrokeIcon path={CLOSE_ICON} />
        </button>
      </div>

      {current ? (
        <ConversationArea
          conversation={current}
          variant="panel"
          onSendMessage={(body) => sendMessage(current.id, body)}
          onRequestSupport={() => requestSupport(current.id)}
          onCloseConversation={() => closeConversation(current.id)}
        />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="type-body m-0 text-notice-muted">{copy.emptyPanelPrompt}</p>
          <button
            type="button"
            onClick={startNewConversation}
            className="type-button inline-flex min-h-11 items-center rounded-full bg-action-dark theme-gradient-action px-5 text-on-action-dark transition-colors hover:bg-action-dark-hover"
          >
            {copy.startConversation}
          </button>
        </div>
      )}
    </section>
  );
}
