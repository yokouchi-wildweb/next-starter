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
 * Firebase が生成した URL から oobCode を抽出します。
 */
function extractOobCode(firebaseUrl: string): string {
  const url = new URL(firebaseUrl);
  const oobCode = url.searchParams.get("oobCode");

  if (!oobCode) {
    throw new DomainError("Firebase URLからoobCodeを抽出できませんでした", { status: 500 });
  }

  return oobCode;
}

/**
 * Firebase Admin SDK でメールアドレス変更リンクを生成し、Resend でメールを送信します。
 * Firebase のデフォルトアクションページ（英語）をスキップし、アプリのページに直接飛ばします。
 */
export async function sendEmailChangeLink({
  currentEmail,
  newEmail,
  origin,
}: SendEmailChangeLinkParams): Promise<void> {
  const auth = getServerAuth();
  const baseOrigin = origin.replace(/\/$/, "");

  const actionCodeSettings: ActionCodeSettings = {
    url: `${baseOrigin}/email/verify`,
  };

  let firebaseGeneratedUrl: string;

  // 新しいメールアドレスが既に Firebase Auth に存在するか確認
  try {
    await auth.getUserByEmail(newEmail);
    // ユーザーが見つかった場合は既に使用されている
    throw new DomainError("このメールアドレスは既に使用されています", { status: 409 });
  } catch (error) {
    // DomainError はそのまま再スロー
    if (error instanceof DomainError) throw error;
    // auth/user-not-found は期待通り（新しいメールアドレスは未使用）
  }

  // メールアドレス変更リンクを生成
  try {
    firebaseGeneratedUrl = await auth.generateVerifyAndChangeEmailLink(
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

  // Firebase のアクションページをスキップし、アプリに直接飛ばす URL を生成
  const oobCode = extractOobCode(firebaseGeneratedUrl);
  const verificationUrl = `${baseOrigin}/email/verify?oobCode=${encodeURIComponent(oobCode)}`;

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
