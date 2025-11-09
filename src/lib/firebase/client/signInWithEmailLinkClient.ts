// src/lib/firebase/client/signInWithEmailLinkClient.ts

// Firebase Auth のクライアント機能
import { isSignInWithEmailLink, signInWithEmailLink } from "firebase/auth";

import { HttpError, normalizeHttpError } from "@/lib/errors";
import { auth } from "@/lib/firebase/client/app";

/**
 * メールリンクでのサインインを実行する
 * @param email ユーザーが入力したメールアドレス
 * @param link Firebase から届いたリンク (省略時は現在の URL を利用)
 */
export async function signInWithEmailLinkClient(email: string, link?: string) {
  const emailLink = link ?? window.location.href; // 指定が無ければ現在の URL を使う

  if (!isSignInWithEmailLink(auth, emailLink)) {
    throw new HttpError({ message: "メールリンクが無効です" }); // 無効なリンクなら統一エラーとして扱う
  }

  try {
    return await signInWithEmailLink(auth, email, emailLink); // Firebase に処理を委譲
  } catch (error) {
    throw normalizeHttpError(error, "メールリンクでのサインインに失敗しました"); // 例外は HttpError へ正規化
  }
}
