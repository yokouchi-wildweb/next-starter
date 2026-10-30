// src/features/core/user/services/server/finders/hasActiveUserWithRoles.ts

import type { UserRoleType } from "@/features/core/user/types";
import { base } from "../drizzleBase";

/**
 * 指定ロールのいずれかを持つユーザーが 1 人以上いるかを返す低レベルファインダー。
 *
 * - 論理削除済み (deleted_at IS NOT NULL) のユーザーは数えない(base.count は soft delete を除く)。
 *   削除済みも数える checkAdminUserExists とは判定が違う(初期セットアップ側はそちらを使う)。
 * - 行は読まず件数だけを見る。
 * - userService 経由ではなく drizzleBase を直接参照しているため、auth ドメインの
 *   auth の authorization.ts(ページの守りの setup 誘導)から循環依存なしに呼べる。
 */
export async function hasActiveUserWithRoles(roles: readonly UserRoleType[]): Promise<boolean> {
  if (roles.length === 0) return false;
  const { total } = await base.count({
    where: { field: "role", op: "in", value: [...roles] },
  });
  return total > 0;
}
