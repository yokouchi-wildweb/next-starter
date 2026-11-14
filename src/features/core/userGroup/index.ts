// src/features/core/userGroup/index.ts
// ユーザーグループの公開の入口(型と設定の型。server の口は ./services/server)

export type * from "./types";
export type { UserGroupConfig, UserGroupOverride } from "./config";
export { USER_GROUP_KINDS, USER_GROUP_STATUSES, USER_GROUP_VERSION_STATUSES } from "./entities/schema";
