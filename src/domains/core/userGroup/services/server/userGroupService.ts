// src/domains/core/userGroup/services/server/userGroupService.ts
// ユーザーグループの service: CRUD の土台 + 評価の口(count・isMember・listMemberIds・evaluate、./evaluation)
// + 静的グループへ書く口(replaceMembers・addMembers・removeMembers、./writes)。定期計算は cron(./recompute)。作る・直す口は次の指令

import { userGroupBase } from "./userGroupBase";
import { userGroupEvaluator } from "./evaluation";
import { staticMemberWriter } from "./writes";

export const userGroupService = {
  ...userGroupBase,
  count: userGroupEvaluator.count,
  isMember: userGroupEvaluator.isMember,
  listMemberIds: userGroupEvaluator.listMemberIds,
  evaluate: userGroupEvaluator.evaluate,
  replaceMembers: staticMemberWriter.replaceMembers,
  addMembers: staticMemberWriter.addMembers,
  removeMembers: staticMemberWriter.removeMembers,
};
