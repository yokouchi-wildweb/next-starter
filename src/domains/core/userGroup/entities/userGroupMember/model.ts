// src/domains/core/userGroup/entities/userGroupMember/model.ts

import { UserGroupMemberTable } from "./drizzle";

export type UserGroupMember = typeof UserGroupMemberTable.$inferSelect;
