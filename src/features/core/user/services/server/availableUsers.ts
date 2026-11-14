// src/features/core/user/services/server/availableUsers.ts
// 「利用できる利用者」の公開の述語(D103)。サーバーの読み手が users の行を絞る 1 か所:
// 削除されていない(deleted_at IS NULL)・状態が USER_AVAILABLE_STATUSES(今は active)・デモの利用者(is_demo)は既定で外す。
// 読み手: messaging の全員・ロール宛ての展開と数え(sendMessage/store.ts)、ユーザーグループの母集団(次の指令)。
// API・ページの守り(routeFactory の availableStatuses)・pairedDevice・client の useStatusChecker は今は自分の状態の並びを持つ(README)

import { and, eq, inArray, isNull, type SQL } from "drizzle-orm";

import { USER_AVAILABLE_STATUSES } from "@/features/core/user/constants";
import { UserTable } from "@/features/core/user/entities/drizzle";

export type AvailableUserOptions = {
  /** デモの利用者も含める(既定 false = 外す) */
  includeDemo?: boolean;
};

/** users の行への SQL の述語(where にそのまま渡す。他の条件とは and で組む) */
export function availableUserWhere(options: AvailableUserOptions = {}): SQL {
  const conditions: SQL[] = [isNull(UserTable.deletedAt), inArray(UserTable.status, [...USER_AVAILABLE_STATUSES])];
  if (!options.includeDemo) conditions.push(eq(UserTable.isDemo, false));
  return and(...conditions)!;
}
