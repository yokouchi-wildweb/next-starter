// src/features/messaging/services/server/index.ts

export { messagingService } from "./messagingService";
export type { MessagingService } from "./messagingService";

export { send } from "./send";
export { bulkSend } from "./bulkSend";
export { sendMessage, sendMessageToMany } from "./sendMessage";
export { continueSending, pruneMessagingRecords, runSendSweep } from "./sweep";
export type { ContinueSendingResult, RetentionResult, SendSweepResult } from "./sweep";
export type {
  MessageAudienceSpec,
  MessageDeliveryOutcome,
  MessageRecipient,
  SendMessageInput,
  SendMessageResult,
  SendMessageToManyInput,
} from "./sendMessage";
export { createDispatch, completeDispatch, findExistingIdempotencyKeys } from "./dispatch";
export { recordRecipientAudits } from "./auditing";
export {
  sendEmailViaTemplate,
  sendInAppNotification,
} from "./channels";
