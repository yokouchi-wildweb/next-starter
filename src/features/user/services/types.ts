// src/features/user/services/form.ts

import type { GeneralUserOptionalFields, User } from "@/features/user/entities";

export type CreateUserInput = {
  displayName: string;
  email: string;
  role: User["role"];
  localPassword: string;
};

export type UpdateUserInput = Partial<Omit<GeneralUserOptionalFields, "localPassword">> & {
  localPassword?: string | null;
  newPassword?: string | null;
};
