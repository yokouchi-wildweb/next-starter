// src/features/core/auth/services/server/sendSignInLink.ts

import type { ActionCodeSettings } from "firebase-admin/auth";

import { getServerAuth } from "@/lib/firebase/server/app";
import { VerificationEmail } from "@/features/core/mail/templates/VerificationEmail";
import { toDirectSignInLink } from "@/features/core/auth/services/server/toDirectSignInLink";
import { DomainError } from "@/lib/errors";

export type SendSignInLinkParams = {
  /** 送信先メールアドレス */
  email: string;
  /** リダイレクト先のオリジン（例: https://example.com） */
  origin: string;
};

/**
 * Firebase Admin SDK でサインインリンクを生成し、Resend でメールを送信します。
 * 生成リンクは firebaseapp.com の中継ページを経由しないアプリ直リンクに
 * 組み直して送信します（toDirectSignInLink 参照）。
 */
export async function sendSignInLink({
  email,
  origin,
}: SendSignInLinkParams): Promise<void> {
  const auth = getServerAuth();
  const baseUrl = `${origin.replace(/\/$/, "")}/signup/verify`;
  const continueUrl = `${baseUrl}?email=${encodeURIComponent(email)}`;

  const actionCodeSettings: ActionCodeSettings = {
    url: continueUrl,
    handleCodeInApp: true,
  };

  let firebaseGeneratedUrl: string;

  try {
    firebaseGeneratedUrl = await auth.generateSignInWithEmailLink(
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

  // firebaseapp.com のアクションページをスキップし、アプリに直接飛ばす URL を生成
  const verificationUrl = toDirectSignInLink(firebaseGeneratedUrl, continueUrl);

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
