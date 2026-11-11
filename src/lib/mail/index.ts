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
// 色の生成物(pnpm generate styles が src/styles の palette から書く。生成区画 ./generated/)
export { MAIL_THEME_COLORS } from "./generated/themeColors";
