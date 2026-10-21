// src/features/core/pairedDevice/utils/principalUserRule.ts
// principalGuard / requireCurrentPrincipal の orUser の判定（純粋関数）

import type { SessionUser } from "@/features/core/auth/entities/session";
import { USER_AVAILABLE_STATUSES, getRoleCategory } from "@/features/core/user/constants";
import type { UserRoleType, UserStatus } from "@/features/core/user/types";

/**
 * 端末でない場合に通すユーザーのルール。
 * - "authenticated": ログインしていて利用可能なステータスのユーザー
 * - { roles?, roleCategories? }: どちらかに合うユーザー（両方省略 = "authenticated" と同じ）
 * - allowStatuses: 通すステータス（省略時は USER_AVAILABLE_STATUSES。authGuard と同じ語彙）
 */
export type PrincipalUserRule =
  | "authenticated"
  | {
      roles?: readonly UserRoleType[];
      roleCategories?: readonly string[];
      allowStatuses?: readonly UserStatus[];
    };

/** ユーザーがルールに合うか（ステータス → ロールの順に判定。ロール判定は DB 同期の値） */
export function matchesPrincipalUserRule(user: SessionUser, rule: PrincipalUserRule): boolean {
  const allowStatuses =
    (rule !== "authenticated" ? rule.allowStatuses : undefined) ?? USER_AVAILABLE_STATUSES;
  if (!allowStatuses.includes(user.status)) return false;
  if (rule === "authenticated") return true;
  if (!rule.roles && !rule.roleCategories) return true;
  if (rule.roles?.includes(user.role)) return true;
  const category = getRoleCategory(user.role);
  return !!category && !!rule.roleCategories?.includes(category);
}
