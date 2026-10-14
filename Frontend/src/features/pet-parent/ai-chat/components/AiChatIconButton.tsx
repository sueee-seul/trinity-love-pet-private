import type { ReactElement } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  HEADER_ICON,
  HEADER_ICON_BUTTON,
  HEADER_ICON_BUTTON_ACTIVE,
  HEADER_ICON_DOT,
  HEADER_ICON_STROKE_WIDTH,
} from '../../../../shared/components/ui/headerIconStyles';
import { usePortalCopy } from '../../i18n/portalLocale';
import { CHAT_COPY } from '../chatCopy';
import { AI_CHAT_PAGE_PATH, hidesFloatingChat } from '../chatRoutes';
import { useAiChatStore } from '../store';

/** The same circle as the bell beside it; the current or open state fills it. */
const triggerClass = (isActive: boolean): string =>
  `${HEADER_ICON_BUTTON} ${isActive ? HEADER_ICON_BUTTON_ACTIVE : ''}`;

function ChatGlyph({ hasActiveConversation }: { hasActiveConversation: boolean }): ReactElement {
  return (
    <span className={HEADER_ICON}>
      <svg
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={HEADER_ICON_STROKE_WIDTH}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        />
      </svg>
      {hasActiveConversation && <span aria-hidden="true" className={HEADER_ICON_DOT} />}
    </span>
  );
}

export function AiChatIconButton(): ReactElement {
  const copy = usePortalCopy(CHAT_COPY);
  const { pathname } = useLocation();
  const isPanelOpen = useAiChatStore((state) => state.isPanelOpen);
  const openPanel = useAiChatStore((state) => state.openPanel);
  const closePanel = useAiChatStore((state) => state.closePanel);
  const hasActiveConversation = useAiChatStore((state) => Boolean(state.activeConversation()));

  // Where the floating panel stays hidden, a toggle would do nothing visible, so the icon leads to
  // the chat page instead.
  if (hidesFloatingChat(pathname)) {
    const isChatPage = pathname.startsWith(AI_CHAT_PAGE_PATH);
    return (
      <Link
        to={AI_CHAT_PAGE_PATH}
        aria-label={copy.openChat}
        aria-current={isChatPage ? 'page' : undefined}
        className={triggerClass(isChatPage)}
      >
        <ChatGlyph hasActiveConversation={hasActiveConversation} />
      </Link>
    );
  }

  return (
    <button
      type="button"
      aria-label={copy.openChat}
      aria-expanded={isPanelOpen}
      onClick={() => (isPanelOpen ? closePanel() : openPanel())}
      className={triggerClass(isPanelOpen)}
    >
      <ChatGlyph hasActiveConversation={hasActiveConversation} />
    </button>
  );
}
