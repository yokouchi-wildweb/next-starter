// src/features/auth/services/server/requireRole.ts
//
// カスタム API ルート（createApiRoute 直接利用）でハンドラ先頭に置く認可ガード。
//
// createApiRoute は認可を強制しない（fail-open）ため、認証・認可が必要なルートでは
// ハンドラ内でこれらを明示的に呼ぶ。失敗時は DomainError を throw すると、
// createApiRoute のエラーハンドラが status / message を持つ JSON レスポンスに変換する。
//
// ロール判定は DB 同期される getSessionUser を使う（ctx.session は token-only 由来で
// ロール剥奪・利用停止が即時反映されないため、認可には使わない）。
// 汎用ルート側の評価ロジック（evaluateApiAccessRule）と判定基準を揃えている。

import type { SessionUser } from "@/features/core/auth/entities/session";
import { USER_AVAILABLE_STATUSES, getRoleCategory } from "@/features/core/user/constants";
import { DomainError } from "@/lib/errors";

import { getSessionUser } from "./session/getSessionUser";

/**
 * ログイン必須ガード。
 * 未認証なら 401、利用停止中（banned 等）なら 403 を throw する。
 * 成功時は DB 同期済みの SessionUser を返す。
 */
export async function requireAuthenticated(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new DomainError("認証が必要です。", { status: 401 });
  }
  if (!USER_AVAILABLE_STATUSES.includes(user.status)) {
    throw new DomainError("この操作を行う権限がありません。", { status: 403 });
  }
  return user;
}

/**
 * 管理者限定ガード。
 * 未認証なら 401、admin カテゴリ以外・利用停止中なら 403 を throw する。
 * 成功時は DB 同期済みの SessionUser を返す。
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireAuthenticated();
  if (getRoleCategory(user.role) !== "admin") {
    throw new DomainError("この操作を行う権限がありません。", { status: 403 });
  }
  return user;
}
