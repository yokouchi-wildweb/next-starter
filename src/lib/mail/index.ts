// src/lib/mail/index.ts

export { createMailTemplate } from "./createMailTemplate";
export type {
  MailSendOptions,
  MailTemplate,
  MailTemplateConfig,
} from "./createMailTemplate";
export { send, type MailProvider, type SendMailOptions } from "./send";
