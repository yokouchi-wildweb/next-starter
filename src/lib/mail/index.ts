// src/lib/mail/index.ts

import type { ReactElement } from "react";

import { render } from "@react-email/render";

import { businessConfig } from "@/config/business.config";

import { getResendClient } from "./resend";
import { getSendGridClient } from "./sendgrid";

export { createMailTemplate } from "./createMailTemplate";
export type {
  MailSendOptions,
  MailTemplate,
  MailTemplateConfig,
} from "./createMailTemplate";

/**
 * メールプロバイダーの種類
 * - resend: Resend（デフォルト）
 * - sendgrid: SendGrid
 */
export type MailProvider = "resend" | "sendgrid";

/**
 * 使用するメールプロバイダーを取得します。
 * 環境変数 MAIL_PROVIDER で切り替え可能（デフォルト: resend）
 */
function getMailProvider(): MailProvider {
  const provider = process.env.MAIL_PROVIDER as MailProvider | undefined;
  if (provider === "sendgrid") {
    return "sendgrid";
  }
  return "resend";
}

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
 * Resendでメールを送信します。
 */
async function sendWithResend(
  to: string,
  subject: string,
  react: ReactElement,
  fromField: string,
): Promise<void> {
  const resend = getResendClient();

  const { error } = await resend.emails.send({
    from: fromField,
    to,
    subject,
    react,
  });

  if (error) {
    throw new Error(`メール送信に失敗しました（Resend）: ${error.message}`);
  }
}

/**
 * SendGridでメールを送信します。
 */
async function sendWithSendGrid(
  to: string,
  subject: string,
  react: ReactElement,
  fromAddress: string,
  fromName?: string,
): Promise<void> {
  const sgMail = getSendGridClient();
  const html = await render(react);

  try {
    await sgMail.send({
      to,
      from: fromName ? { email: fromAddress, name: fromName } : fromAddress,
      subject,
      html,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラー";
    throw new Error(`メール送信に失敗しました（SendGrid）: ${message}`);
  }
}

/**
 * メールを送信します。
 *
 * プロバイダーは環境変数 MAIL_PROVIDER で切り替え可能:
 * - "resend"（デフォルト）: RESEND_API_KEY が必要
 * - "sendgrid": SENDGRID_API_KEY が必要
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

  const provider = getMailProvider();

  if (provider === "sendgrid") {
    await sendWithSendGrid(to, subject, react, fromAddress, senderName);
  } else {
    const fromField = senderName
      ? `${senderName} <${fromAddress}>`
      : fromAddress;
    await sendWithResend(to, subject, react, fromField);
  }
}
