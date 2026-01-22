// src/features/user/services/form.ts

import type { UserOptionalFields, User } from "@/features/core/user/entities";

export type CreateUserInput = {
  name: string;
  email: string;
  role: User["role"];
  localPassword: string;
  actorId?: string;
  profileData?: Record<string, unknown>;
};

export type CreateDemoUserInput = {
  name: string;
  email: string;
  role: User["role"];
  localPassword: string;
  profileData?: Record<string, unknown>;
};

export type UpdateUserInput = Partial<Omit<UserOptionalFields, "localPassword">> & {
  localPassword?: string | null;
  newPassword?: string | null;
  profileData?: Record<string, unknown>;
};
