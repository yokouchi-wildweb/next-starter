// src/features/core/auth/services/server/sendPasswordResetLink.ts

import type { ActionCodeSettings } from "firebase-admin/auth";

import { getServerAuth } from "@/lib/firebase/server/app";
import { PasswordResetEmail } from "@/features/core/mail/templates/PasswordResetEmail";
import { DomainError } from "@/lib/errors";

export type SendPasswordResetLinkParams = {
  /** パスワードリセット対象のメールアドレス */
  email: string;
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
 * Firebase Admin SDK でパスワードリセットリンクを生成し、Resend でメールを送信します。
 * Firebase のデフォルトアクションページ（英語）をスキップし、アプリのページに直接飛ばします。
 */
export async function sendPasswordResetLink({
  email,
  origin,
}: SendPasswordResetLinkParams): Promise<void> {
  const auth = getServerAuth();
  const baseOrigin = origin.replace(/\/$/, "");

  const actionCodeSettings: ActionCodeSettings = {
    url: `${baseOrigin}/password/reset`,
  };

  let firebaseGeneratedUrl: string;

  // メールアドレスが Firebase Auth に存在するか確認
  try {
    await auth.getUserByEmail(email);
  } catch (error) {
    // ユーザーが見つからない場合でも、セキュリティのためエラーを表示しない
    // （メールアドレスの存在確認攻撃を防ぐ）
    // ただし、実際にはメールは送信しない
    return;
  }

  // パスワードリセットリンクを生成
  try {
    firebaseGeneratedUrl = await auth.generatePasswordResetLink(
      email,
      actionCodeSettings,
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new DomainError(
      `パスワードリセットリンクの生成に失敗しました: ${reason}`,
      { status: 500 },
    );
  }

  // Firebase のアクションページをスキップし、アプリに直接飛ばす URL を生成
  const oobCode = extractOobCode(firebaseGeneratedUrl);
  const resetUrl = `${baseOrigin}/password/reset?oobCode=${encodeURIComponent(oobCode)}`;

  try {
    await PasswordResetEmail.send(email, {
      resetUrl,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new DomainError(
      `パスワードリセットメールの送信に失敗しました: ${reason}`,
      { status: 500 },
    );
  }
}
