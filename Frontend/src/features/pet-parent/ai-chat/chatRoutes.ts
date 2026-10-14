export const AI_CHAT_PAGE_PATH = '/parent/ai-chat';

// Pages that already hold a conversation of their own: the chat page itself, and booking, which
// has its own booking assistant. A second chat floating over them would compete with it.
const PAGES_WITHOUT_FLOATING_CHAT = [AI_CHAT_PAGE_PATH, '/parent/booking'] as const;

/** Whether the floating chat panel stays hidden on `pathname`, including the pages beneath it. */
export function hidesFloatingChat(pathname: string): boolean {
  return PAGES_WITHOUT_FLOATING_CHAT.some(
    (page) => pathname === page || pathname.startsWith(`${page}/`),
  );
}
