// src/lib/firebase/client/sendVerificationEmail.ts

import { sendSignInLinkToEmail, type ActionCodeSettings } from "firebase/auth";

import { normalizeHttpError } from "@/lib/errors";
import { auth } from "@/lib/firebase/client/app";

/**
 * 指定したメールアドレス宛に認証メール（メールリンク）を送信します。
 *
 * Firebase Auth の状態を確認せず、指定されたメールアドレスへ直接メールリンクを送信します。
 */
export async function sendVerificationEmail(
  email: string,
  actionCodeSettings: ActionCodeSettings,
): Promise<void> {
  try {
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
  } catch (error) {
    throw normalizeHttpError(error, "認証メールの送信に失敗しました");
  }
}
