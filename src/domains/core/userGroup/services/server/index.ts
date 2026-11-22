// src/domains/core/userGroup/services/server/index.ts
// ユーザーグループの server の入口

export { userGroupService } from "./userGroupService";
export {
  checkUserGroupDefinition,
  type UserGroupDefinitionCheck,
  type UserGroupDefinitionLimits,
} from "./definition/checkDefinition";
export { activeCriteria as userGroupCriteria, createActiveCriteria } from "./activeCriteria";
export {
  compileUserGroupDefinition,
  createUserGroupEvaluator,
  userGroupEvaluator,
  type UserGroupEvaluator,
  type UserGroupEvaluatorDeps,
  type UserGroupMemberWhere,
  type UserGroupSendTarget,
} from "./evaluation";
export {
  createStaticMemberWriter,
  staticMemberWriter,
  type AddMembersResult,
  type RemoveMembersResult,
  type ReplaceMembersOptions,
  type ReplaceMembersResult,
  type StaticMemberWriter,
  type StaticMemberWriterDeps,
  type UserIdSupplier,
} from "./writes";
export {
  createUserGroupRecompute,
  isRecomputeDue,
  runUserGroupRecompute,
  type UserGroupRecompute,
  type UserGroupRecomputeDeps,
  type UserGroupRecomputeResult,
} from "./recompute";
export {
  createUserGroupAdminService,
  userGroupAdmin,
  type UserGroupAdminDeps,
  type UserGroupAdminService,
} from "./admin";
