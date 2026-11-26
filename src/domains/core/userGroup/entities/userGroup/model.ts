// src/domains/core/userGroup/entities/userGroup/model.ts

import { UserGroupTable } from "./drizzle";

export type UserGroup = typeof UserGroupTable.$inferSelect;
export type UserGroupInsert = typeof UserGroupTable.$inferInsert;
