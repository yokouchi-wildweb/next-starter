// src/domains/core/auth/services/server/authorization.ts
//
// ページの守り(lib/pageGuard)に auth が渡す部品。束は点 pageGuardUser の項目 ../../plugs/pageGuardUser/session.default.ts(結ぶのは生成物 src/wiring/pageGuard.ts)。
// 旧来の authGuard・hasAdminUser は削除した(範囲の守りは guard.ts の guard()、主体は loader の文脈の getUser())。

import { headers } from "next/headers";

import { getRolesByCategory } from "@/domains/core/user/constants";
import { hasActiveUserWithRoles } from "@/domains/core/user/services/server/finders/hasActiveUserWithRoles";
import type { RoleCategory, UserRoleType } from "@/domains/core/user/types";
import type { DomainApiAccessRule } from "@/lib/domainAccess";

/** proxy.ts で付与された x-pathname ヘッダーから現在のパスを取得する(ページの守りの returnTo に使う) */
export async function getRequestPathname(): Promise<string | null> {
  const headersList = await headers();
  return headersList.get("x-pathname");
}

/**
 * access(authenticated / {roles, roleCategories})を満たしうる利用者が 1 人以上いるかを返す
 * (ページの守りの setup 誘導の判定。点 pageGuardUser の項目の束に入る。真偽値だけ)。
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
