// src/features/core/user/services/server/registration/sendRegistrationCompleteMail.ts

import { APP_FEATURES } from "@/config/app/app-features.config";
import { EarlyRegistrationCompleteEmail } from "@/features/core/mail/templates/EarlyRegistrationCompleteEmail";
import { RegistrationCompleteEmail } from "@/features/core/mail/templates/RegistrationCompleteEmail";
import { DomainError } from "@/lib/errors";

export type SendRegistrationCompleteMailParams = {
  email: string;
  displayName: string;
};

/**
 * 登録完了メールを送信します。
 * サインアップモードに応じて適切なテンプレートを使用します。
 */
export async function sendRegistrationCompleteMail({
  email,
  displayName,
}: SendRegistrationCompleteMailParams): Promise<void> {
  const { mode } = APP_FEATURES.auth.signup;

  try {
    if (mode === "earlyRegistration") {
      await EarlyRegistrationCompleteEmail.send(email, { displayName });
    } else {
      await RegistrationCompleteEmail.send(email, { displayName });
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new DomainError(
      `登録完了メールの送信に失敗しました: ${reason}`,
      { status: 500 },
    );
  }
}
