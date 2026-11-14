// src/features/core/userGroup/types/index.ts
// ユーザーグループの公開の型(受け口の項目の型もここ。extensionPoints.ts の type が指す)

export type { UserGroupCriterion, UserGroupCriterionContext } from "./criterion";
export type {
  UserGroupDefinitionNode,
  UserGroupKind,
  UserGroupStatus,
  UserGroupVersionStatus,
} from "../entities/schema";
