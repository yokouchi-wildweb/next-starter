// src/features/user/entities/model.ts

import type { BaseEntity } from "@/lib/crud";
import type { UserProviderType, UserRoleType, UserStatus } from "@/features/core/user/types";

export type User = BaseEntity & {
  providerType: UserProviderType;
  providerUid: string;
  email: string | null;
  name: string | null;
  role: UserRoleType;
  localPassword: string | null;
  status: UserStatus;
  isDemo: boolean;
  lastAuthenticatedAt: Date | null;
  deletedAt: Date | null;
};

