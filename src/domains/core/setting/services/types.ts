// src/domains/core/setting/services/types.ts

import type { CreateAdminInput } from "@/domains/core/user/services/server/creation/console";

export type AdminSetupInput = Pick<CreateAdminInput, "name" | "email" | "localPassword"> &
  Partial<Omit<CreateAdminInput, "name" | "email" | "localPassword" | "role">>;
