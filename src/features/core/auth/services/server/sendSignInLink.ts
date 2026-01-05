// src/features/core/auth/services/server/sendSignInLink.ts

import type { ActionCodeSettings } from "firebase-admin/auth";

import { getServerAuth } from "@/lib/firebase/server/app";
import { VerificationEmail } from "@/features/core/mail/templates/VerificationEmail";
import { AUTH_CONTINUE_URL } from "@/features/core/auth/config/authSettings";
import { DomainError } from "@/lib/errors";

export type SendSignInLinkParams = {
  /** 送信先メールアドレス */
  email: string;
  /** リダイレクト先のオリジン（例: https://example.com） */
  origin: string;
};

/**
 * Firebase Admin SDK でサインインリンクを生成し、Resend でメールを送信します。
 */
export async function sendSignInLink({
  email,
  origin,
}: SendSignInLinkParams): Promise<void> {
  const auth = getServerAuth();
  const baseUrl = `${origin.replace(/\/$/, "")}${AUTH_CONTINUE_URL}`;
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
    await VerificationEmail.send(email, {
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
