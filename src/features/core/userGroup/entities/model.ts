// src/features/core/userGroup/entities/model.ts
// ユーザーグループの行の型(drizzle の表から)

import type {
  UserGroupDefinitionTable,
  UserGroupMemberTable,
  UserGroupTable,
  UserGroupVersionMemberTable,
  UserGroupVersionTable,
} from "./drizzle";

export type UserGroup = typeof UserGroupTable.$inferSelect;
export type UserGroupInsert = typeof UserGroupTable.$inferInsert;
export type UserGroupDefinition = typeof UserGroupDefinitionTable.$inferSelect;
export type UserGroupMember = typeof UserGroupMemberTable.$inferSelect;
export type UserGroupVersion = typeof UserGroupVersionTable.$inferSelect;
export type UserGroupVersionMember = typeof UserGroupVersionMemberTable.$inferSelect;
