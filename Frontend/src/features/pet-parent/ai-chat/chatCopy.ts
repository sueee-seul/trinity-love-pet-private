import type { PortalCopy } from '../i18n/portalLocale';
import { NEW_CONVERSATION_TOPIC, SUPPORT_REQUESTED_NOTICE, topicFor } from './conversationText';
import type { Conversation, ConversationTopicCategory } from './types';

/** The parent chat's own words: page, floating panel, sidebar, conversation and inactivity prompt. */
export interface ChatCopy {
  conversationList: string;
  openConversation: string;
  // Floating panel
  panelLabel: string;
  expandChat: string;
  assistantName: string;
  expandPanel: string;
  close: string;
  minimise: string;
  expandToPage: string;
  /** The minimised bar's status line, with the pet the active conversation is about. */
  activeStatus: (petName: string | null) => string;
  emptyPanelPrompt: string;
  startConversation: string;
  openChat: string;
  // Conversation
  aiThinkingLabel: string;
  aiThinkingText: string;
  backToConversations: string;
  noConversation: string;
  startedAt: (day: string, time: string) => string;
  dayAndTime: (day: string, time: string) => string;
  contactSupport: string;
  closeConversation: string;
  closedReadOnly: string;
  messageLabel: string;
  pagePlaceholder: string;
  panelPlaceholder: string;
  sendMessage: string;
  pageFootnote: string;
  // Sidebar
  conversations: string;
  newConversation: string;
  closeCurrentFirst: string;
  currentHeading: string;
  pastHeading: string;
  noPastConversations: string;
  sidebarFootnote: string;
  /** The past row's subject when a conversation is not about one pet. */
  generalSubject: string;
  withSupport: (agentName: string | undefined) => string;
  supportRequested: string;
  // Message bubbles
  supportRole: string;
  managerRole: string;
  supportSender: (authorName: string, role: string) => string;
  /** The greeting a new conversation opens with, before the parent has written anything. */
  welcome: (parentName: string | null) => string;
  petCardsIntroOne: (petName: string) => string;
  petCardsIntroMany: string;
  petAnswersIntroMany: string;
  suggestedOptions: string;
  // Inactivity prompt
  inactivityTitle: string;
  inactivityIdleFor: string;
  inactivityBody: string;
  continueWithAi: string;
  closeNoLongerNeeded: string;
  closingNote: string;
  /** A conversation's title, in this language when the chat wrote it, else as the server sent it. */
  topic: (conversation: Conversation) => string;
  /** A system line, in this language when the chat wrote it, else as the server sent it. */
  systemNotice: (body: string) => string;
}

const ZH_TOPIC_CATEGORY: Record<ConversationTopicCategory, string> = {
  Feeding: '喂食',
  Booking: '预约',
  Medication: '用药',
  General: '一般',
};

/*
 * Only titles the chat built itself are rewritten (see conversationText.ts). Anything else, such as
 * a title a future server sends, is shown as delivered rather than guessed at.
 */
const zhTopic = (conversation: Conversation): string => {
  if (conversation.topic === NEW_CONVERSATION_TOPIC) {
    return '新对话';
  }
  if (conversation.topic !== topicFor(conversation.petName, conversation.topicCategory)) {
    return conversation.topic;
  }
  const category = ZH_TOPIC_CATEGORY[conversation.topicCategory];
  return conversation.petName ? `${conversation.petName} · ${category}` : `${category}咨询`;
};

export const CHAT_COPY: PortalCopy<ChatCopy> = {
  en: {
    conversationList: 'Conversation list',
    openConversation: 'Open conversation',
    panelLabel: 'AI chat',
    expandChat: 'Expand AI Chat',
    assistantName: 'AI Assistant',
    expandPanel: 'Expand panel',
    close: 'Close',
    minimise: 'Minimise',
    expandToPage: 'Expand to full page',
    activeStatus: (petName) => `Active${petName ? ` · ${petName}'s care` : ''}`,
    emptyPanelPrompt: 'Ask about your pets, bookings or care updates.',
    startConversation: 'Start a conversation',
    openChat: 'Open AI Chat',
    aiThinkingLabel: 'AI is thinking',
    aiThinkingText: 'AI Assistant is thinking…',
    backToConversations: 'Back to conversations',
    noConversation: 'Start a new conversation to ask about your pets, bookings or care updates.',
    startedAt: (day, time) => `Started ${day}, ${time}`,
    dayAndTime: (day, time) => `${day}, ${time}`,
    contactSupport: 'Contact Customer Support',
    closeConversation: 'Close conversation',
    closedReadOnly: 'This conversation is closed and read-only.',
    messageLabel: 'Message',
    pagePlaceholder: 'Ask about your pets, bookings or care updates…',
    panelPlaceholder: 'Type your message…',
    sendMessage: 'Send message',
    pageFootnote:
      "Answers use your pet's records at Wagstay. Need a person? Ask to contact Customer Support.",
    conversations: 'Conversations',
    newConversation: 'New conversation',
    closeCurrentFirst: 'Please close your current conversation before starting a new one.',
    currentHeading: 'Current',
    pastHeading: 'Past',
    noPastConversations: 'No past conversations yet.',
    sidebarFootnote:
      'Past conversations are read-only. Only one conversation can be active at a time.',
    generalSubject: 'General',
    withSupport: (agentName) => `With Customer Support${agentName ? ` · ${agentName}` : ''}`,
    supportRequested: 'Support requested',
    supportRole: 'Customer Support',
    managerRole: 'Manager from Customer Support',
    supportSender: (authorName, role) => `${authorName} (${role})`,
    welcome: (parentName) =>
      parentName ? `Hi ${parentName}, how can I help you today?` : 'Hi, how can I help you today?',
    petCardsIntroOne: (petName) => `Here’s what I found for ${petName}.`,
    petCardsIntroMany: 'Here’s the information currently recorded for each pet.',
    petAnswersIntroMany: 'Here are the answers for each pet.',
    suggestedOptions: 'Suggested options',
    inactivityTitle: 'Do you still need help?',
    inactivityIdleFor: 'No messages for 10 minutes',
    inactivityBody:
      "It looks like you haven't sent a message for a while. You can keep chatting with the AI assistant, continue with Customer Support, or close this conversation if you no longer need help.",
    continueWithAi: 'Continue with AI',
    closeNoLongerNeeded: 'Close conversation: I no longer need help',
    closingNote:
      'Closing moves this conversation to your past conversations. You can start a new one any time.',
    topic: (conversation) => conversation.topic,
    systemNotice: (body) => body,
  },
  zh: {
    conversationList: '对话列表',
    openConversation: '当前对话',
    panelLabel: 'AI 聊天',
    expandChat: '展开 AI 聊天',
    assistantName: 'AI 助手',
    expandPanel: '展开面板',
    close: '关闭',
    minimise: '最小化',
    expandToPage: '全屏打开',
    activeStatus: (petName) => `进行中${petName ? ` · ${petName}的照护` : ''}`,
    emptyPanelPrompt: '可以问问宠物、预约或照护动态。',
    startConversation: '开始对话',
    openChat: '打开 AI 聊天',
    aiThinkingLabel: 'AI 正在思考',
    aiThinkingText: 'AI 助手正在思考…',
    backToConversations: '返回对话列表',
    noConversation: '开始一个新对话，问问宠物、预约或照护动态。',
    startedAt: (day, time) => `开始于 ${day} ${time}`,
    dayAndTime: (day, time) => `${day} ${time}`,
    contactSupport: '联系客服',
    closeConversation: '结束对话',
    closedReadOnly: '这个对话已经结束，只能查看。',
    messageLabel: '消息',
    pagePlaceholder: '问问宠物、预约或照护动态…',
    panelPlaceholder: '输入消息…',
    sendMessage: '发送消息',
    pageFootnote: '回答会参考你的宠物在 Wagstay 的记录。想找真人？可以请求联系客服。',
    conversations: '对话',
    newConversation: '新对话',
    closeCurrentFirst: '请先结束当前对话，再开始新的对话。',
    currentHeading: '当前',
    pastHeading: '历史',
    noPastConversations: '还没有历史对话。',
    sidebarFootnote: '历史对话只能查看。同一时间只能有一个进行中的对话。',
    generalSubject: '一般',
    withSupport: (agentName) => `客服处理中${agentName ? ` · ${agentName}` : ''}`,
    supportRequested: '已请求客服',
    supportRole: '客服',
    managerRole: '客服经理',
    supportSender: (authorName, role) => `${authorName}（${role}）`,
    welcome: (parentName) =>
      parentName ? `${parentName}，你好！今天有什么可以帮你？` : '你好！今天有什么可以帮你？',
    petCardsIntroOne: (petName) => `这是我找到的${petName}的信息。`,
    petCardsIntroMany: '这是每只宠物目前记录的信息。',
    petAnswersIntroMany: '以下是每只宠物的答案。',
    suggestedOptions: '建议选项',
    inactivityTitle: '还需要帮助吗？',
    inactivityIdleFor: '已经 10 分钟没有新消息',
    inactivityBody:
      '你已经有一段时间没有发消息了。你可以继续和 AI 助手聊天，转给客服，或者在不再需要帮助时结束这个对话。',
    continueWithAi: '继续和 AI 聊',
    closeNoLongerNeeded: '结束对话：我不再需要帮助',
    closingNote: '结束后，这个对话会移到历史对话里。你随时可以开始新的对话。',
    topic: zhTopic,
    systemNotice: (body) => (body === SUPPORT_REQUESTED_NOTICE ? '已请求客服' : body),
  },
};
