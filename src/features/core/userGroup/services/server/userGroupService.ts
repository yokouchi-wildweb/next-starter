// src/features/core/userGroup/services/server/userGroupService.ts
// ユーザーグループの service: CRUD の土台 + 評価の口(count・isMember・listMemberIds・evaluate、./evaluation)。
// 作る・直す・静的グループへ書く口・定期計算は次の指令

import { userGroupBase } from "./drizzleBase";
import { userGroupEvaluator } from "./evaluation";

export const userGroupService = {
  ...userGroupBase,
  count: userGroupEvaluator.count,
  isMember: userGroupEvaluator.isMember,
  listMemberIds: userGroupEvaluator.listMemberIds,
  evaluate: userGroupEvaluator.evaluate,
};
