// src/features/core/user/types/index.ts

import {
  USER_PROVIDER_TYPES,
  USER_ROLE_OPTIONS,
  USER_ROLES,
  USER_STATUSES,
} from "@/features/core/user/constants";

export type UserProviderType = (typeof USER_PROVIDER_TYPES)[number];
export type UserRoleType = (typeof USER_ROLES)[number];
export type UserStatus = (typeof USER_STATUSES)[number];
export type UserRoleOption = (typeof USER_ROLE_OPTIONS)[number];
