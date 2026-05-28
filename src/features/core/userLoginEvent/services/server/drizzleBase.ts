// src/features/core/userLoginEvent/services/server/drizzleBase.ts

import { UserLoginEventTable } from "@/features/core/userLoginEvent/entities/drizzle";
import {
  UserLoginEventCreateSchema,
  type UserLoginEventCreateInput,
} from "@/features/core/userLoginEvent/entities/schema";
import { createCrudService } from "@/lib/crud/drizzle";
import type { DrizzleCrudServiceOptions } from "@/lib/crud/drizzle/types";

const userLoginEventOptions: DrizzleCrudServiceOptions<UserLoginEventCreateInput> = {
  idType: "uuid",
  defaultOrderBy: [["occurredAt", "DESC"]],
  parseCreate: (data) => UserLoginEventCreateSchema.parse(data),
};

export const userLoginEventBase = createCrudService(UserLoginEventTable, userLoginEventOptions);
