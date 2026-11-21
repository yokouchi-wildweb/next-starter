// src/features/core/userLoginEvent/services/server/drizzleBase.ts

import { UserLoginEventTable } from "@/features/userLoginEvent/entities/drizzle";
import {
  UserLoginEventCreateSchema,
  type UserLoginEventCreateInput,
} from "@/features/userLoginEvent/entities/schema";
import { createCrudService } from "@/lib/crud/server";
import type { CrudServiceOptions } from "@/lib/crud/server";

const userLoginEventOptions: CrudServiceOptions<UserLoginEventCreateInput> = {
  idType: "uuid",
  defaultOrderBy: [["occurredAt", "DESC"]],
  parseCreate: (data) => UserLoginEventCreateSchema.parse(data),
};

export const userLoginEventBase = createCrudService(UserLoginEventTable, userLoginEventOptions);
