// src/features/user/services/server/wrappers/create.ts
import type { User } from "@/features/user/entities";
import {
  registerAdminFromConsole,
  registerGeneralUserFromConsole,
} from "../registrations";
import type { CreateUserInput } from "../../types";

export function create(data: CreateUserInput): Promise<User> {
  if (data.role === "admin") {
    return registerAdminFromConsole(data);
  }

  return registerGeneralUserFromConsole(data);
}
