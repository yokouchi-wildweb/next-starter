// src/features/core/userGroup/services/server/recompute/index.ts
// 本物の定期計算(cron user-group-recompute が呼ぶ): system として、設定の予算の締切まで

import { runAsSystem } from "@/lib/audit";
import { createDeadline } from "@/lib/cron";
import { db } from "@/lib/drizzle";

import { userGroupConfig } from "../../../config";
import { criteria } from "../../../extensions/criteria";
import { createUserGroupRecompute, type UserGroupRecomputeResult } from "./recompute";

const recompute = createUserGroupRecompute({ db, criteria, config: userGroupConfig, now: () => new Date() });

/** 期限の来た定期計算のグループを計算する(cron user-group-recompute) */
export function runUserGroupRecompute(): Promise<UserGroupRecomputeResult> {
  return runAsSystem(() => recompute.run({ deadline: createDeadline(userGroupConfig.recompute.budgetMs) }));
}

export { createUserGroupRecompute, isRecomputeDue, type UserGroupRecompute, type UserGroupRecomputeDeps, type UserGroupRecomputeResult } from "./recompute";
