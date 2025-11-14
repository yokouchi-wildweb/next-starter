// src/features/user/entities/model.ts

import type { BaseEntity } from "@/types/entity";
import type { UserProviderType, UserRoleType, UserStatus } from "@/types/user";

export type User = BaseEntity & {
  providerType: UserProviderType;
  providerUid: string;
  email: string | null;
  displayName: string | null;
  role: UserRoleType;
  localPasswordHash: string | null;
  status: UserStatus;
  lastAuthenticatedAt: Date | null;
};

