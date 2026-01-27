// src/features/core/auth/services/server/sendEmailChangeLink.ts

import type { ActionCodeSettings } from "firebase-admin/auth";

import { getServerAuth } from "@/lib/firebase/server/app";
import { EmailChangeEmail } from "@/features/core/mail/templates/EmailChangeEmail";
import { DomainError } from "@/lib/errors";

export type SendEmailChangeLinkParams = {
  /** 現在のメールアドレス */
  currentEmail: string;
  /** 新しいメールアドレス */
  newEmail: string;
  /** リダイレクト先のオリジン（例: https://example.com） */
  origin: string;
};

/**
 * Firebase Admin SDK でメールアドレス変更リンクを生成し、Resend でメールを送信します。
 */
export async function sendEmailChangeLink({
  currentEmail,
  newEmail,
  origin,
}: SendEmailChangeLinkParams): Promise<void> {
  const auth = getServerAuth();
  const continueUrl = `${origin.replace(/\/$/, "")}/email/verify`;

  const actionCodeSettings: ActionCodeSettings = {
    url: continueUrl,
    handleCodeInApp: true,
  };

  let verificationUrl: string;

  try {
    verificationUrl = await auth.generateVerifyAndChangeEmailLink(
      currentEmail,
      newEmail,
      actionCodeSettings,
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new DomainError(
      `メールアドレス変更リンクの生成に失敗しました: ${reason}`,
      { status: 500 },
    );
  }

  try {
    // 新しいメールアドレス宛に送信
    await EmailChangeEmail.send(newEmail, {
      verificationUrl,
      newEmail,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new DomainError(
      `確認メールの送信に失敗しました: ${reason}`,
      { status: 500 },
    );
  }
}
