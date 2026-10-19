// src/features/core/user/utils/userOption.ts
// ユーザー選択 UI(UserAsyncCombobox / UserAsyncMultiSelect)向けの純粋ヘルパー

import type { ReactNode } from "react";
import type { User } from "@/features/core/user/entities";
import type { UserRoleType } from "@/features/core/user/types";
import type { Options } from "@/components/Form/types";
import type { WhereExpr } from "@/lib/crud/types";

/**
 * デフォルトのラベル生成: 名前（メール） / メール / id
 */
export function defaultFormatUserLabel(user: User): ReactNode {
  if (user.name) {
    return user.email ? `${user.name}（${user.email}）` : user.name;
  }
  return user.email ?? user.id;
}

/**
 * User → Options 変換
 */
export function getUserOption(
  user: User,
  formatLabel?: (user: User) => ReactNode,
): Options {
  return {
    label: formatLabel ? formatLabel(user) : defaultFormatUserLabel(user),
    value: user.id,
  };
}

/**
 * role prop から WhereExpr を生成
 */
function buildRoleWhere(role: UserRoleType | UserRoleType[]): WhereExpr {
  if (Array.isArray(role)) {
    return { field: "role", op: "in", value: role };
  }
  return { field: "role", op: "eq", value: role };
}

/**
 * role と where を結合して最終的な WhereExpr を生成
 */
export function mergeUserWhere(
  role?: UserRoleType | UserRoleType[],
  where?: WhereExpr,
): WhereExpr | undefined {
  const conditions: WhereExpr[] = [];

  if (role) {
    conditions.push(buildRoleWhere(role));
  }
  if (where) {
    conditions.push(where);
  }

  if (conditions.length === 0) return undefined;
  if (conditions.length === 1) return conditions[0];
  return { and: conditions };
}

/** デフォルトの検索フィールド */
export const DEFAULT_USER_SEARCH_FIELDS = ["name", "email"];
