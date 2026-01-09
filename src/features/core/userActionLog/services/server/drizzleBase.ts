// src/features/core/userActionLog/services/server/drizzleBase.ts

import { UserActionLogTable } from "@/features/core/userActionLog/entities/drizzle";
import {
  UserActionLogCreateSchema,
  type UserActionLogCreateInput,
} from "@/features/core/userActionLog/entities/schema";
import { createCrudService } from "@/lib/crud/drizzle";
import type { DrizzleCrudServiceOptions } from "@/lib/crud/drizzle/types";

const baseOptions: DrizzleCrudServiceOptions<UserActionLogCreateInput> = {
  idType: "uuid",
  defaultOrderBy: [["createdAt", "DESC"]],
  parseCreate: (data) => UserActionLogCreateSchema.parse(data),
};

export const base = createCrudService<typeof UserActionLogTable, UserActionLogCreateInput>(
  UserActionLogTable,
  baseOptions,
);
