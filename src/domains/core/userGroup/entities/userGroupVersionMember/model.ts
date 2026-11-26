// src/domains/core/userGroup/entities/userGroupVersionMember/model.ts

import { UserGroupVersionMemberTable } from "./drizzle";

export type UserGroupVersionMember = typeof UserGroupVersionMemberTable.$inferSelect;
