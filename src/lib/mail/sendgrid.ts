// src/lib/mail/sendgrid.ts

import sgMail, { type MailService } from "@sendgrid/mail";

function getSendGridApiKey(): string {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    throw new Error(
      "SENDGRID_API_KEY が設定されていません。環境変数を確認してください。",
    );
  }
  return apiKey;
}

let initialized = false;

/**
 * SendGridクライアントを取得します。
 * 初回呼び出し時にAPIキーを設定します。
 */
export function getSendGridClient(): MailService {
  if (!initialized) {
    sgMail.setApiKey(getSendGridApiKey());
    initialized = true;
  }
  return sgMail;
}
