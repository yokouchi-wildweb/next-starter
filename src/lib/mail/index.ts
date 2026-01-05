// src/lib/mail/index.ts

import type { ReactElement } from "react";

import { businessConfig } from "@/config/business.config";

import { getResendClient } from "./resend";

export { createMailTemplate } from "./createMailTemplate";
export type {
  MailSendOptions,
  MailTemplate,
  MailTemplateConfig,
} from "./createMailTemplate";

export type SendMailOptions = {
  /** 宛先メールアドレス */
  to: string;
  /** 件名 */
  subject: string;
  /** React Emailコンポーネント */
  react: ReactElement;
  /** 送信元メールアドレス（省略時は businessConfig.mail.defaultFrom） */
  from?: string;
  /** 送信者名（省略時は businessConfig.mail.defaultFromName） */
  fromName?: string;
};

/**
 * メールを送信します。
 *
 * @example
 * ```ts
 * import { send } from "@/lib/mail";
 * import { VerificationEmail } from "@/features/core/mail/templates/VerificationEmail";
 *
 * await send({
 *   to: "user@example.com",
 *   subject: "メールアドレスの確認",
 *   react: <VerificationEmail url={verificationUrl} />,
 * });
 * ```
 */
export async function send(options: SendMailOptions): Promise<void> {
  const { to, subject, react, from, fromName } = options;

  const fromAddress = from ?? businessConfig.mail.defaultFrom;
  const senderName = fromName ?? businessConfig.mail.defaultFromName;
  const fromField = senderName ? `${senderName} <${fromAddress}>` : fromAddress;

  const resend = getResendClient();

  const { error } = await resend.emails.send({
    from: fromField,
    to,
    subject,
    react,
  });

  if (error) {
    throw new Error(`メール送信に失敗しました: ${error.message}`);
  }
}
