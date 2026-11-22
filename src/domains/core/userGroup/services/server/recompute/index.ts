// src/domains/core/userGroup/services/server/recompute/index.ts
// 本物の定期計算(cron user-group-recompute が呼ぶ): 設定の予算の締切まで。system の文脈は入口(lib/cron の route)が敷く

import { createDeadline } from "@/lib/cron";
import { db } from "@/lib/drizzle";

import { userGroupConfig } from "../../../config";
import { activeCriteria as criteria } from "../activeCriteria";
import { createUserGroupRecompute, type UserGroupRecomputeResult } from "./recompute";

const recompute = createUserGroupRecompute({ db, criteria, config: userGroupConfig, now: () => new Date() });

/** 期限の来た定期計算のグループを計算する(cron user-group-recompute) */
export function runUserGroupRecompute(): Promise<UserGroupRecomputeResult> {
  return recompute.run({ deadline: createDeadline(userGroupConfig.recompute.budgetMs) });
}

export { createUserGroupRecompute, isRecomputeDue, type UserGroupRecompute, type UserGroupRecomputeDeps, type UserGroupRecomputeResult } from "./recompute";
