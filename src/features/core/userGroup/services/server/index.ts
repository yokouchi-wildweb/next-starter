// src/features/core/userGroup/services/server/index.ts
// ユーザーグループの server の入口

export { userGroupService } from "./userGroupService";
export {
  checkUserGroupDefinition,
  type UserGroupDefinitionCheck,
  type UserGroupDefinitionLimits,
} from "./definition/checkDefinition";
export { criteria as userGroupCriteria } from "../../extensions/criteria";
