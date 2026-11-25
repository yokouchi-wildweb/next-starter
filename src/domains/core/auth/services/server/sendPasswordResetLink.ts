// src/domains/core/auth/services/server/sendPasswordResetLink.ts

import type { ActionCodeSettings } from "firebase-admin/auth";

import { getServerAuth } from "@/lib/firebase/server";
import { message as passwordResetMessage } from "@/domains/core/auth/plugs/messages/passwordReset";
import { sendMailMessage } from "@/domains/core/auth/services/server/sendMailMessage";
import { DomainError } from "@/lib/errors";
import { recordSignupFailure } from "./signupAudit";

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
 * Firebase Admin SDK でパスワードリセットリンクを生成し、連絡 auth.passwordReset を送る口(messagingService.sendMessage)で送ります。
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
    // ただし、実際にはメールは送信しない(記録だけ残す。signupAudit)
    await recordSignupFailure({ flow: "password_reset", reason: "user_not_found", email });
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
    await recordSignupFailure({ flow: "password_reset", reason: "link_generation_failed", email });
    throw new DomainError(
      `パスワードリセットリンクの生成に失敗しました: ${reason}`,
      { status: 500 },
    );
  }

  // Firebase のアクションページをスキップし、アプリに直接飛ばす URL を生成
  const oobCode = extractOobCode(firebaseGeneratedUrl);
  const resetUrl = `${baseOrigin}/password/reset?oobCode=${encodeURIComponent(oobCode)}`;

  try {
    await sendMailMessage(passwordResetMessage, email, { resetUrl });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await recordSignupFailure({ flow: "password_reset", reason: "mail_send_failed", email });
    throw new DomainError(
      `パスワードリセットメールの送信に失敗しました: ${reason}`,
      { status: 500 },
    );
  }
}
