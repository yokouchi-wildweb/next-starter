// src/features/core/user/components/common/userSelectUtils.ts

import type { ReactNode } from "react";
import type { User } from "@/features/core/user/entities";
import type { UserRoleType } from "@/features/core/user/types";
import type { Options } from "@/components/Form/types";
import type { SearchParams, PaginatedResult, WhereExpr } from "@/lib/crud/types";
import { userClient } from "@/features/core/user/services/client/userClient";

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
function mergeWhereConditions(
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

/**
 * userClient.search をラップし、role/where 条件をマージする検索関数を返す
 */
export function createUserSearchFn(
  role?: UserRoleType | UserRoleType[],
  where?: WhereExpr,
): (params: SearchParams) => Promise<PaginatedResult<User>> {
  const mergedWhere = mergeWhereConditions(role, where);

  return (params: SearchParams) => {
    const finalWhere = (() => {
      if (!mergedWhere && !params.where) return undefined;
      if (!mergedWhere) return params.where;
      if (!params.where) return mergedWhere;
      return { and: [mergedWhere, params.where] };
    })();

    return userClient.search!({
      ...params,
      where: finalWhere,
    });
  };
}

/** デフォルトの検索フィールド */
export const DEFAULT_USER_SEARCH_FIELDS = ["name", "email"];
