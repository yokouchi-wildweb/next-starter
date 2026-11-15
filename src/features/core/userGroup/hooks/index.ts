// src/features/core/userGroup/hooks/index.ts
// ユーザーグループの管理画面の hook(公開。部品は props だけで描き、流れはここ)

export { USER_GROUPS_KEY, USER_GROUP_CRITERIA_KEY, userGroupKey } from "./userGroupKeys";
export { useUserGroups, type UseUserGroupsOptions } from "./useUserGroups";
export { useUserGroup, useUserGroupCriteriaCatalog } from "./useUserGroup";
export { useAdminUserGroupList, userGroupSummaryOf, type UserGroupAction } from "./useAdminUserGroupList";
export {
  CONDITION_MAX_DEPTH,
  CONDITION_OP_LABELS,
  conditionFromDefinition,
  conditionHasHeavy,
  conditionProblems,
  conditionToDefinition,
  defaultArgsOf,
  emptyConditionRoot,
  useUserGroupConditionBuilder,
  type ConditionBuilderState,
  type ConditionDraftGroup,
  type ConditionDraftLeaf,
  type ConditionDraftNode,
  type ConditionGroupOp,
  type CriterionCatalogItem,
} from "./useUserGroupConditionBuilder";
export { criterionArgsOf, criterionFormValues, useUserGroupCriterionArgs } from "./useUserGroupCriterionArgs";
export {
  HEAVY_WARNING,
  RECOMPUTE_INTERVAL_CHOICES,
  STATIC_SOURCE_LABELS,
  intervalLabel,
  staticSourceOf,
  useUserGroupForm,
  type StaticSourceDraft,
  type UserGroupFormState,
} from "./useUserGroupForm";
export { useUserGroupEstimate, type UserGroupEstimateState } from "./useUserGroupEstimate";
export { FREEZE_MAX_ROUNDS, useUserGroupFreeze, type UserGroupFreezeProgress, type UserGroupFreezeState } from "./useUserGroupFreeze";
export { useUserGroupPeople, type UserGroupPeopleState } from "./useUserGroupPeople";
export { useUserGroupStaticMembers } from "./useUserGroupStaticMembers";
export { useUserGroupExceptions, type UserGroupExceptionsState } from "./useUserGroupExceptions";
export { useUserGroupModal, type UserGroupModalState, type UserGroupModalTab } from "./useUserGroupModal";
export { useAddToUserGroup, type AddToUserGroupResult, type AddToUserGroupState } from "./useAddToUserGroup";
