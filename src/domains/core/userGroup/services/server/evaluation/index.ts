// src/domains/core/userGroup/services/server/evaluation/index.ts
// 本物の評価の口(db・生成の部品の一覧・設定・門 userGroups・今の時刻)

import { gate } from "@/featureGate";
import { db } from "@/lib/drizzle";

import { userGroupConfig } from "../../../config";
import { activeCriteria as criteria } from "../activeCriteria";
import { createUserGroupEvaluator } from "./evaluator";

export const userGroupEvaluator = createUserGroupEvaluator({
  db,
  criteria,
  config: userGroupConfig,
  gateEnabled: () => gate.enabled("userGroups"),
  now: () => new Date(),
});

export { compileUserGroupDefinition, type CompileOptions } from "./compile";
export {
  createUserGroupEvaluator,
  type UserGroupEvaluator,
  type UserGroupEvaluatorDeps,
  type UserGroupMemberWhere,
  type UserGroupSendTarget,
} from "./evaluator";
