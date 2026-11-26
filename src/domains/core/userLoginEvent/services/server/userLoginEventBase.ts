// src/domains/core/userLoginEvent/services/server/userLoginEventBase.ts

import { UserLoginEventTable } from "@/domains/userLoginEvent/entities/drizzle";
import {
  UserLoginEventCreateSchema,
  type UserLoginEventCreateInput,
} from "@/domains/userLoginEvent/entities/schema";
import { createCrudService } from "@/lib/crud/server";
import type { CrudServiceOptions } from "@/lib/crud/server";

const userLoginEventOptions: CrudServiceOptions<UserLoginEventCreateInput> = {
  idType: "uuid",
  defaultOrderBy: [["occurredAt", "DESC"]],
  parseCreate: (data) => UserLoginEventCreateSchema.parse(data),
};

export const userLoginEventBase = createCrudService(UserLoginEventTable, userLoginEventOptions);
