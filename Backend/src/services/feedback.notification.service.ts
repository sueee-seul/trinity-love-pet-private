import type { FeedbackNotificationInput } from '../contracts/feedback.contract.js';
import type { ManagerRecipient } from '../contracts/staff.contract.js';

export interface InternalEmailMessage {
  to: string;
  subject: string;
  body: string;
}

export const buildSuggestionManagerNotification = (
  feedback: FeedbackNotificationInput,
  recipient: ManagerRecipient,
): InternalEmailMessage => ({
  to: recipient.email,
  subject: `New suggestion requires review: ${feedback.parentName} & ${feedback.petName}`,
  body: [
    `A new Suggestion was submitted by ${feedback.parentName}.`,
    `Feedback UUID: ${feedback.uuid}`,
    `Pet: ${feedback.petName}`,
    `Service: ${feedback.serviceType}`,
    `Summary: ${feedback.aiSummary}`,
    `Open in admin: /admin/feedback/${feedback.uuid}`,
  ].join('\n'),
});

export const sendInternalEmail = async (message: InternalEmailMessage): Promise<void> => {
  console.log(
    `[Mock Internal Email] Sending to ${message.to}\n${message.subject}\n${message.body}`,
  );
};

export const notifySuggestionManager = async (
  feedback: FeedbackNotificationInput,
  recipient: ManagerRecipient,
): Promise<void> => {
  await sendInternalEmail(buildSuggestionManagerNotification(feedback, recipient));
};
