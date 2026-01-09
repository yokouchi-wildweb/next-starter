// src/features/core/user/services/server/wrappers/create.ts
import type { User } from "@/features/core/user/entities";
import { createAdmin, createGeneralUser } from "../creation/console";
import type { CreateUserInput } from "@/features/core/user/services/types";

export function create(data: CreateUserInput): Promise<User> {
  if (data.role === "admin") {
    return createAdmin(data);
  }

  return createGeneralUser(data);
}
