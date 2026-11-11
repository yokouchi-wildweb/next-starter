// src/lib/mail/index.ts

export {
  send,
  type MailProvider,
  type SendMailOptions,
  type SendMailReactOptions,
  type SendMailHtmlOptions,
  type SendMailResult,
} from "./send";
export { MailSendError, type MailSendErrorKind } from "./errors";
export * from "./webhooks";
export * from "./frame";
// 色の生成物(pnpm generate styles が src/styles の palette から書く。生成区画 ./generated/)
export { MAIL_THEME_COLORS } from "./generated/themeColors";
export type { MailOverride } from "./config";
