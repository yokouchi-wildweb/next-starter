// src/lib/mail/index.ts

import type { ReactElement } from "react";

import { getResendClient } from "./resend";

export type SendMailOptions = {
  /** 宛先メールアドレス */
  to: string;
  /** 件名 */
  subject: string;
  /** React Emailコンポーネント */
  react: ReactElement;
  /** 送信元メールアドレス（省略時は環境変数から取得） */
  from?: string;
};

function getDefaultFromAddress(): string {
  const fromAddress = process.env.MAIL_FROM_ADDRESS;
  if (!fromAddress) {
    throw new Error(
      "MAIL_FROM_ADDRESS が設定されていません。環境変数を確認してください。",
    );
  }
  return fromAddress;
}

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
  const { to, subject, react, from } = options;
  const fromAddress = from ?? getDefaultFromAddress();
  const resend = getResendClient();

  const { error } = await resend.emails.send({
    from: fromAddress,
    to,
    subject,
    react,
  });

  if (error) {
    throw new Error(`メール送信に失敗しました: ${error.message}`);
  }
}
