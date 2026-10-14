import { useState, type ReactElement } from 'react';
import { PortalPage } from '../../components/layout/PortalPage';
import { usePortalCopy } from '../../i18n/portalLocale';
import { CHAT_COPY } from '../chatCopy';
import { ConversationArea } from '../components/ConversationArea';
import { ConversationSidebar } from '../components/ConversationSidebar';
import { InactivityPromptModal } from '../components/InactivityPromptModal';
import { StayQuickActions } from '../components/StayQuickActions';
import { useAiChatStore } from '../store';
import { useAiChatState } from '../useAiChatState';

/** Which pane a phone shows. From `md` both panes show side by side and this is ignored. */
type PhonePane = 'list' | 'conversation';

export function AiChatPage(): ReactElement {
  const copy = usePortalCopy(CHAT_COPY);
  const { current, past, inactivityPromptVisible } = useAiChatState();
  const sendMessage = useAiChatStore((state) => state.sendMessage);
  const requestSupport = useAiChatStore((state) => state.requestSupport);
  const closeConversation = useAiChatStore((state) => state.closeConversation);
  const startNewConversation = useAiChatStore((state) => state.startNewConversation);
  const continueWithAi = useAiChatStore((state) => state.continueWithAi);
  const dismissInactivityPrompt = useAiChatStore((state) => state.dismissInactivityPrompt);

  // `null` means "no explicit pick yet": it falls back to the active conversation, then the most
  // recent past one, so a freshly-created active conversation is selected without an effect.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // A phone opens on the list, like a messaging app, so every conversation is one tap away.
  const [phonePane, setPhonePane] = useState<PhonePane>('list');

  const all = [...(current ? [current] : []), ...past];
  const selected =
    all.find((conversation) => conversation.id === selectedId) ?? current ?? past[0] ?? null;
  const showsListOnPhone = phonePane === 'list' || selected === null;

  const openConversation = (id: string): void => {
    setSelectedId(id);
    setPhonePane('conversation');
  };

  // A stay change asked from the strip goes to the open conversation, or to a new one.
  const askInChat = (message: string): void => {
    if (!current) startNewConversation();
    const target = current ?? useAiChatStore.getState().activeConversation();
    if (!target) return;
    sendMessage(target.id, message);
    openConversation(target.id);
  };

  return (
    <PortalPage width="wide">
      {/* While a pet is staying, the changes a parent most often asks for sit above the chat. */}
      <StayQuickActions onAsk={askInChat} />
      {/*
       * The chat fills the screen under the header, so the conversation scrolls inside it and the
       * composer stays in view. `--parent-page-chrome` is set by the portal for each breakpoint;
       * the minimum keeps it usable on a phone held sideways, where the page scrolls instead.
       */}
      <div className="flex h-[calc(100dvh_-_var(--parent-page-chrome,11rem))] min-h-[28rem] overflow-hidden rounded-2xl border border-border-soft bg-surface-card shadow-card">
        <section
          aria-label={copy.conversationList}
          className={`${showsListOnPhone ? 'flex' : 'hidden'} min-h-0 w-full md:flex md:w-auto`}
        >
          <ConversationSidebar
            current={current}
            past={past}
            selectedId={selected?.id ?? null}
            onSelect={openConversation}
            onStartNew={() => {
              startNewConversation();
              const created = useAiChatStore.getState().activeConversation();
              if (created) {
                openConversation(created.id);
              }
            }}
          />
        </section>

        <section
          aria-label={copy.openConversation}
          className={`${showsListOnPhone ? 'hidden' : 'flex'} min-w-0 flex-1 flex-col md:flex`}
        >
          <ConversationArea
            conversation={selected}
            variant="page"
            onBack={() => setPhonePane('list')}
            onSendMessage={(body) => selected && sendMessage(selected.id, body)}
            onRequestSupport={() => selected && requestSupport(selected.id)}
            onCloseConversation={() => {
              if (selected) {
                closeConversation(selected.id);
                setSelectedId(null);
              }
            }}
          />
        </section>
      </div>

      <InactivityPromptModal
        isOpen={inactivityPromptVisible}
        onContinueWithAi={continueWithAi}
        onContactSupport={() => {
          if (current) {
            requestSupport(current.id);
          }
          dismissInactivityPrompt();
        }}
        onCloseConversation={() => {
          if (current) {
            closeConversation(current.id);
            setSelectedId(null);
          }
          dismissInactivityPrompt();
        }}
      />
    </PortalPage>
  );
}
