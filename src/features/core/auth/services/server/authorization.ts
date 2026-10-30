// src/features/core/auth/services/server/authorization.ts
//
// ページの守り(lib/pageGuard)に auth が渡す部品。結ぶのは src/wiring/pageGuard.ts(束は pageGuardUserDeps.ts)。
// 旧来の authGuard・hasAdminUser は削除した(範囲の守りは guard.ts の guard()、主体は loader の ctx.user)。

import { headers } from "next/headers";

import { getRolesByCategory } from "@/features/core/user/constants";
import { hasActiveUserWithRoles } from "@/features/core/user/services/server/finders/hasActiveUserWithRoles";
import type { RoleCategory, UserRoleType } from "@/features/core/user/types";
import type { DomainApiAccessRule } from "@/lib/domain";

/** proxy.ts で付与された x-pathname ヘッダーから現在のパスを取得する(ページの守りの returnTo に使う) */
export async function getRequestPathname(): Promise<string | null> {
  const headersList = await headers();
  return headersList.get("x-pathname");
}

/**
 * access(authenticated / {roles, roleCategories})を満たしうる利用者が 1 人以上いるかを返す
 * (ページの守りの setup 誘導の判定。src/wiring/pageGuard.ts が guard の作り手へ渡す。真偽値だけ)。
 * ロールの指定は roles と roleCategories のロールの和。authenticated は全ロール。public / none は常に true。
 * 論理削除済みの利用者は数えない。
 */
export async function hasUserForAccess(rule: DomainApiAccessRule): Promise<boolean> {
  if (rule === "public" || rule === "none") return true;
  const roles =
    rule === "authenticated"
      ? [...getRolesByCategory("admin"), ...getRolesByCategory("user")]
      : [...(rule.roles ?? []), ...(rule.roleCategories ?? []).flatMap((category) => getRolesByCategory(category as RoleCategory))];
  return hasActiveUserWithRoles(roles as UserRoleType[]);
}
