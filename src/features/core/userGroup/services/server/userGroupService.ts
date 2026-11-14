// src/features/core/userGroup/services/server/userGroupService.ts
// ユーザーグループの service(今は CRUD の土台だけ。評価の口 count・isMember・listMemberIds・evaluate は次の指令)

import { userGroupBase } from "./drizzleBase";

export const userGroupService = {
  ...userGroupBase,
};
