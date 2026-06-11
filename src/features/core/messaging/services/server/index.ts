// src/features/messaging/services/server/index.ts

export { messagingService } from "./messagingService";
export type { MessagingService } from "./messagingService";

export { send } from "./send";
export { bulkSend } from "./bulkSend";
export { createDispatch, completeDispatch } from "./dispatch";
export { recordRecipientAudits } from "./auditing";
export {
  sendEmailViaTemplate,
  sendInAppNotification,
} from "./channels";
