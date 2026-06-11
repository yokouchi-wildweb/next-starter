// src/features/auth/services/server/apiAccess.ts
// 汎用ドメイン API のアクセスルールをセッションと照合して評価する

import type { SessionUser } from "@/features/core/auth/entities/session";
import { USER_AVAILABLE_STATUSES, getRoleCategory } from "@/features/core/user/constants";
import type { DomainApiAccessRule } from "@/lib/domain";

/**
 * アクセス評価の結果
 * - granted: 許可
 * - not_found: ルートを存在しないものとして扱う（rule: "none"）
 * - unauthenticated: 未認証（401）
 * - forbidden: 認証済みだが権限不足、または利用不可ステータス（403）
 */
export type ApiAccessDecision = "granted" | "not_found" | "unauthenticated" | "forbidden";

/**
 * アクセスルールをセッションユーザーと照合する。
 *
 * ロール判定は DB 同期済みのセッション（getSessionUser 由来）を渡すこと。
 * token-only セッションではロール剥奪・利用停止が即時反映されない。
 */
export function evaluateApiAccessRule(
  rule: DomainApiAccessRule,
  sessionUser: SessionUser | null,
): ApiAccessDecision {
  if (rule === "none") return "not_found";
  if (rule === "public") return "granted";

  if (!sessionUser) return "unauthenticated";

  // 利用停止中（banned 等）のユーザーは認証済みでも拒否する
  if (!USER_AVAILABLE_STATUSES.includes(sessionUser.status)) {
    return "forbidden";
  }

  if (rule === "authenticated") return "granted";

  if (rule.roles?.includes(sessionUser.role)) return "granted";

  const category = getRoleCategory(sessionUser.role);
  if (category && rule.roleCategories?.includes(category)) return "granted";

  return "forbidden";
}
