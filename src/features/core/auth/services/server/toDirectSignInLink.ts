// src/features/core/auth/services/server/toDirectSignInLink.ts

import { DomainError } from "@/lib/errors";

/**
 * Firebase が生成したサインインリンク（https://{authDomain}/__/auth/action?...）を、
 * 中継ページを経由しないアプリ直リンクに組み直します。
 *
 * 背景: 生成リンクをそのままメールに載せると、クリックのたびに
 * {project}.firebaseapp.com のアクションページを経由してアプリに戻るため、
 * - GA4 のセッション参照元が firebaseapp.com リファラルで上書きされる
 * - メール内リンクのドメインが自ドメインでなくなる（迷惑メール判定・信頼感に不利）
 * パスワードリセット／メール変更（oobCode 抽出方式）と同様に中継をスキップする。
 *
 * クライアントの isSignInWithEmailLink / signInWithEmailLink は URL 中の
 * apiKey / mode / oobCode を参照するため、これらを continueUrl に引き継ぐ。
 */
export function toDirectSignInLink(
  firebaseGeneratedUrl: string,
  continueUrl: string,
): string {
  const source = new URL(firebaseGeneratedUrl);
  const target = new URL(continueUrl);

  // tenantId / lang は存在する場合のみ引き継ぐ（未使用構成では付かない）
  for (const key of ["apiKey", "mode", "oobCode", "lang", "tenantId"]) {
    const value = source.searchParams.get(key);
    if (value !== null) {
      target.searchParams.set(key, value);
    }
  }

  if (
    !target.searchParams.get("apiKey") ||
    !target.searchParams.get("oobCode") ||
    target.searchParams.get("mode") !== "signIn"
  ) {
    throw new DomainError(
      "Firebase URLからサインインリンクを組み立てられませんでした",
      { status: 500 },
    );
  }

  return target.toString();
}
