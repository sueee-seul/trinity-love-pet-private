import type { ConciergeLocale } from './types';

/**
 * The words of the one-step booking card. The consent sentence replaces the two boxes of the full
 * form, so it names both agreements in full: the booking terms with the card rules, and emergency
 * vet care up to NZ$500. Pressing the button, or replying "confirm" in the chat, is the guest's own act; the
 * server records both agreements as it does for the boxes. Change its meaning only with the
 * compliance review in hand.
 */
export interface QuickConfirmCopy {
  title: string;
  lead: string;
  stay: string;
  dates: string;
  pets: string;
  total: string;
  consent: string;
  confirm: string;
  confirming: string;
  replyHint: string;
  editDetails: string;
  missingTitle: string;
  missingLead: string;
  fillDetails: string;
  /** The terms summary names the form's own vet consent box; this card gives it by confirming. */
  tickClause: string;
  tickClauseHere: string;
}

export const QUICK_CONFIRM_COPY: Record<ConciergeLocale, QuickConfirmCopy> = {
  en: {
    title: 'Confirm your booking',
    lead: 'I filled this in from our chat. Check it, then confirm. Nothing is booked until you do.',
    stay: 'Stay',
    dates: 'Dates',
    pets: 'Pets',
    total: 'Total (GST included)',
    consent:
      'By confirming this booking you agree to the booking terms above, including how your card is held, charged and refunded, and that if we can’t reach you, Wagstay may arrange emergency vet treatment for your pet, up to NZ$500.',
    confirm: 'Confirm booking',
    confirming: 'Booking…',
    replyHint: 'You can also reply "confirm" in the chat.',
    editDetails: 'Check or change the details',
    missingTitle: 'A few details are missing',
    missingLead: 'Fill them in on the next step, then send your booking from there.',
    fillDetails: 'Fill in the details',
    tickClause: ', given with its own tick below',
    tickClauseHere: ', given by confirming this booking',
  },
  zh: {
    title: '确认你的预订',
    lead: '我已根据我们的对话填好了下面的内容。请核对后确认。在你确认之前不会产生任何预订。',
    stay: '住宿',
    dates: '日期',
    pets: '宠物',
    total: '合计（含 GST）',
    consent:
      '确认这次预订即表示你同意上面的预约条款，包括银行卡的冻结、扣款和退款规则；并同意联系不上你时，Wagstay 可以为你的宠物安排紧急兽医治疗，费用不超过 NZ$500。',
    confirm: '确认预订',
    confirming: '正在预订…',
    replyHint: '你也可以在对话中回复"确认"。',
    editDetails: '查看或修改资料',
    missingTitle: '还缺少几项资料',
    missingLead: '请在下一步补全资料，然后在那里发送预订。',
    fillDetails: '去补全资料',
    tickClause: '并请在下面单独勾选，授权我们',
    tickClauseHere: '确认预订即表示授权我们',
  },
};
