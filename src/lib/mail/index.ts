// src/lib/mail/index.ts

export { createMailTemplate } from "./createMailTemplate";
export type {
  MailSendOptions,
  MailTemplate,
  MailTemplateConfig,
} from "./createMailTemplate";
export {
  send,
  type MailProvider,
  type SendMailOptions,
  type SendMailResult,
} from "./send";
export { MailSendError, type MailSendErrorKind } from "./errors";
export * from "./webhooks";
export * from "./frame";
export type { MailOverride } from "./config";
