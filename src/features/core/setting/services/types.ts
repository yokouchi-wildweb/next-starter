// src/features/core/setting/services/types.ts

import type { CreateAdminInput } from "@/features/core/user/services/server/creation/console";

export type AdminSetupInput = Pick<CreateAdminInput, "displayName" | "email" | "localPassword"> &
  Partial<Omit<CreateAdminInput, "displayName" | "email" | "localPassword">>;
