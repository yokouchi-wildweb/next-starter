// src/features/user/services/types.ts

import type { User } from "@/features/user/entities";

export type CreateUserInput = {
  displayName: string;
  email: string;
  role: User["role"];
  password: string;
};
