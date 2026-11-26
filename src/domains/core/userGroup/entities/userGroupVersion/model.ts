// src/domains/core/userGroup/entities/userGroupVersion/model.ts

import { UserGroupVersionTable } from "./drizzle";

export type UserGroupVersion = typeof UserGroupVersionTable.$inferSelect;
