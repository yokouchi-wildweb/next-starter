// src/lib/mail/provider.ts

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
export function getMailProvider(): MailProvider {
  const provider = process.env.MAIL_PROVIDER as MailProvider | undefined;
  if (provider === "sendgrid") {
    return "sendgrid";
  }
  return "resend";
}
