// src/features/core/mail/services/server/sendVerificationEmail.tsx

import { send } from "@/lib/mail";

import { VERIFICATION_EMAIL_SUBJECT } from "../../constants";
import { VerificationEmail } from "../../templates/VerificationEmail";

export type SendVerificationEmailParams = {
  /** 宛先メールアドレス */
  to: string;
  /** 認証用URL */
  verificationUrl: string;
};

/**
 * メールアドレス認証用のメールを送信します。
 */
export async function sendVerificationEmail({
  to,
  verificationUrl,
}: SendVerificationEmailParams): Promise<void> {
  await send({
    to,
    subject: VERIFICATION_EMAIL_SUBJECT,
    react: <VerificationEmail verificationUrl={verificationUrl} email={to} />,
  });
}
