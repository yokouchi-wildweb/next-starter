// src/domains/core/userGroup/entities/userGroupDefinition/model.ts

import { UserGroupDefinitionTable } from "./drizzle";

export type UserGroupDefinition = typeof UserGroupDefinitionTable.$inferSelect;
