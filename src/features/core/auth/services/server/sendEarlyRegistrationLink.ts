// src/features/core/auth/services/server/sendEarlyRegistrationLink.ts

import type { ActionCodeSettings } from "firebase-admin/auth";

import { getServerAuth } from "@/lib/firebase/server/app";
import { EarlyRegistrationEmail } from "@/features/core/mail/templates/EarlyRegistrationEmail";
import { DomainError } from "@/lib/errors";

export type SendEarlyRegistrationLinkParams = {
  /** 送信先メールアドレス */
  email: string;
  /** リダイレクト先のオリジン（例: https://example.com） */
  origin: string;
};

/**
 * Firebase Admin SDK で事前登録用サインインリンクを生成し、メールを送信します。
 */
export async function sendEarlyRegistrationLink({
  email,
  origin,
}: SendEarlyRegistrationLinkParams): Promise<void> {
  const auth = getServerAuth();
  const baseUrl = `${origin.replace(/\/$/, "")}/signup/verify`;
  const continueUrl = `${baseUrl}?email=${encodeURIComponent(email)}`;

  const actionCodeSettings: ActionCodeSettings = {
    url: continueUrl,
    handleCodeInApp: true,
  };

  let verificationUrl: string;

  try {
    verificationUrl = await auth.generateSignInWithEmailLink(
      email,
      actionCodeSettings,
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new DomainError(
      `サインインリンクの生成に失敗しました: ${reason}`,
      { status: 500 },
    );
  }

  try {
    await EarlyRegistrationEmail.send(email, {
      verificationUrl,
      email,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new DomainError(
      `認証メールの送信に失敗しました: ${reason}`,
      { status: 500 },
    );
  }
}
