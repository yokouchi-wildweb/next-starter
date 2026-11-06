// src/features/core/auth/services/server/session/invalidationBoundary.ts
//
// 全セッション失効の境目(users.sessions_invalidated_at)との比較を 1 か所に置く(D18: 失効はすぐ効き、プロバイダーの協力に頼らない)。
// - アプリの JWT: iat が境目より前なら失効(resolveSessionUser、./token.ts)
// - Firebase の ID トークンをセッションに替えるとき: auth_time(その Firebase のセッションの認証時刻)が境目より前なら拒む
//   (firebaseSession・registration)。invalidateSessionsForUser は境目を書いた後に Firebase のリフレッシュトークンの取り消しを
//   できたらやる扱いで呼ぶので、取り消しが失敗しても verifyIdToken(checkRevoked) が通ってしまう。それでも境目で止める
// 秒に切り捨てて比べる(JWT の iat / auth_time は秒)。境目と同じ秒に出たものは通す(今までの JWT の決まりと同じ)

import { DomainError } from "@/lib/errors";

/** epochSeconds(iat / auth_time)が失効の境目より前か。境目が無ければ false */
export function isBeforeSessionInvalidation(epochSeconds: number, sessionsInvalidatedAt: Date | null | undefined): boolean {
  if (!sessionsInvalidatedAt) return false;
  return epochSeconds < Math.floor(sessionsInvalidatedAt.getTime() / 1000);
}

/**
 * ID トークンの認証時刻が失効の境目より後であることを確かめる。前・auth_time が無い(境目があるとき)なら 401
 * (verifyIdToken の失敗と同じエラー = 再ログインが要る)
 */
export function assertAuthenticatedAfterInvalidation(
  decodedToken: { auth_time?: unknown },
  user: { sessionsInvalidatedAt?: Date | null },
): void {
  if (!user.sessionsInvalidatedAt) return;
  const authTime = decodedToken.auth_time;
  if (typeof authTime !== "number" || isBeforeSessionInvalidation(authTime, user.sessionsInvalidatedAt)) {
    throw new DomainError("認証情報の検証に失敗しました", { status: 401 });
  }
}
