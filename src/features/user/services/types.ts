// src/features/user/services/types.ts

import type { GeneralUserOptionalFields, User } from "@/features/user/entities";

export type CreateUserInput = {
  displayName: string;
  email: string;
  role: User["role"];
  password: string;
};

export type UpdateUserInput = Partial<GeneralUserOptionalFields> & {
  password?: string | null;
};
