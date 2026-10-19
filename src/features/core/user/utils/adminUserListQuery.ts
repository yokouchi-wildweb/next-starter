// src/features/core/user/utils/adminUserListQuery.ts
// 管理画面のユーザー一覧(一般 / システム管理者 / デモ)の検索条件。3 つの一覧ルートの loader が共有する

import type { OrderBySpec, WhereExpr } from "@/lib/crud/types";
import { getRolesByCategory, type RoleCategory } from "@/features/core/user/constants";
import { normalizePhoneSearchQuery } from "@/features/core/user/utils/phoneNumber";

/** 一覧の種類: ロール区分で絞る一覧(デモ除外) or デモユーザーの一覧(ロール不問) */
export type AdminUserListKind = { category: RoleCategory } | { demo: true };

export type AdminUserListQuery = {
  where: WhereExpr;
  orderBy: OrderBySpec;
  searchQuery: string | undefined;
};

/**
 * 管理画面のユーザー一覧の where / orderBy / 検索語を組み立てる。
 * - 並び順: `?sortBy=updatedAt` なら更新日時、それ以外は作成日時の降順
 * - 検索語: ロール区分の一覧では国内形式の電話番号を E.164 に直す(デモ一覧は電話番号を持たないのでそのまま)
 */
export function buildAdminUserListQuery(
  kind: AdminUserListKind,
  sortBy: string | undefined,
  searchQuery: string | undefined,
): AdminUserListQuery {
  const orderByField = sortBy === "updatedAt" ? "updatedAt" : "createdAt";
  const orderBy: OrderBySpec = [[orderByField, "DESC"]];

  if ("demo" in kind) {
    return { where: { field: "isDemo", op: "eq", value: true }, orderBy, searchQuery };
  }

  const roleConditions: WhereExpr[] = getRolesByCategory(kind.category).map((role) => ({
    field: "role",
    op: "eq" as const,
    value: role,
  }));
  return {
    where: { and: [{ or: roleConditions }, { field: "isDemo", op: "eq", value: false }] },
    orderBy,
    searchQuery: normalizePhoneSearchQuery(searchQuery),
  };
}
