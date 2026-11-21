// src/features/core/userGroup/services/server/admin/index.ts
// 本物の管理の service(db・部品の一覧・設定・評価の口・静的グループへ書く口・監査)。/api/admin/user-groups/** が呼ぶ

import { eq } from "drizzle-orm";

import { gate } from "@/featureGate";
import { auditLogger } from "@/features/core/auditLog/services/server";
import { getRoleCategory } from "@/features/core/user/constants";
import { UserTable } from "@/features/core/user/entities/drizzle";
import { getAuditContext } from "@/lib/audit/server";
import { db } from "@/lib/drizzle";

import { userGroupConfig } from "../../../config";
import { activeCriteria as criteria } from "../activeCriteria";
import { createUserGroupEvaluator, userGroupEvaluator } from "../evaluation";
import { staticMemberWriter } from "../writes";
import { createUserGroupAdminService } from "./adminService";

/** 一覧で動的グループを数える評価の口(1 件の時間の上限 = admin.listCountTimeoutMs) */
const listEvaluator = createUserGroupEvaluator({
  db,
  criteria,
  config: { ...userGroupConfig, evaluation: { ...userGroupConfig.evaluation, timeoutMs: userGroupConfig.admin.listCountTimeoutMs } },
  gateEnabled: () => gate.enabled("userGroups"),
  now: () => new Date(),
});

export const userGroupAdmin = createUserGroupAdminService({
  db,
  criteria,
  config: userGroupConfig,
  evaluator: userGroupEvaluator,
  listEvaluator,
  writer: staticMemberWriter,
  context: () => getAuditContext(),
  async roleCategoryOf(userId) {
    const [row] = await db.select({ role: UserTable.role }).from(UserTable).where(eq(UserTable.id, userId)).limit(1);
    return row ? (getRoleCategory(row.role) ?? null) : null;
  },
  recordAudit: (input) => auditLogger.record(input),
  now: () => new Date(),
});

export { createUserGroupAdminService, type UserGroupAdminDeps, type UserGroupAdminService } from "./adminService";
export { unwrapExceptions, wrapWithExceptions, type ExceptionGroupIds } from "./exceptions";
export { USER_GROUP_KIND_LABELS, USER_GROUP_STATUS_LABELS } from "./dto";
export type * from "./dto";
