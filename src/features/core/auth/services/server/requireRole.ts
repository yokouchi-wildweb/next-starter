// src/features/core/auth/services/server/requireRole.ts
//
// @deprecated API ルートでは使わない。主体は API の Factory（@/wiring/apiRoute）が 1 回だけ DB 同期で解き、
// access の宣言（"authenticated" / { roles, roleCategories }、必要なら allowStatuses）で認可して ctx.user で渡す。
// upstream の route からの呼び出しは 0。fork の route が Factory の宣言へ移るまでの互換のため残している
// （判定基準は evaluateApiAccessRule と同じ。失敗時は DomainError を throw）。fork の移行が済んだら削除する。

import type { SessionUser } from "@/features/core/auth/entities/session";
import { USER_AVAILABLE_STATUSES, getRoleCategory } from "@/features/core/user/constants";
import type { UserStatus } from "@/features/core/user/types";
import { DomainError } from "@/lib/errors";

import { getSessionUser } from "./session/getSessionUser";

export type RequireAuthenticatedOptions = {
  /**
   * 通過を許可するユーザーステータス。省略時は USER_AVAILABLE_STATUSES（active のみ）。
   * 「利用制限中でも本人が完了すべき手続き」（不正疑いチャレンジの回答・異議申立て・
   * 再有効化・KYC 等）のルートで suspended 等を明示列挙する。
   * fail-closed: 列挙していないステータス（banned / security_locked / withdrawn 等）は常に 403。
   * authGuard の allowStatuses と同じ語彙。
   */
  allowStatuses?: readonly UserStatus[];
};

/**
 * ログイン必須ガード。
 * 未認証なら 401、利用停止中（banned 等）なら 403 を throw する。
 * 成功時は DB 同期済みの SessionUser を返す。
 */
export async function requireAuthenticated(
  options: RequireAuthenticatedOptions = {},
): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new DomainError("認証が必要です。", { status: 401 });
  }
  const allowedStatuses = options.allowStatuses ?? USER_AVAILABLE_STATUSES;
  if (!allowedStatuses.includes(user.status)) {
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
