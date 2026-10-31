// src/features/user/services/form.ts

import type { UserOptionalFields, User } from "@/features/core/user/entities";
import type { USER_BULK_UPDATE } from "@/config/app/user-bulk-update.config";

export type CreateUserInput = {
  name: string;
  email: string;
  role: User["role"];
  localPassword: string;
  profileData?: Record<string, unknown>;
  user_tag_ids?: string[];
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
  user_tag_ids?: string[];
};

/** 一括更新で渡せる列(USER_BULK_UPDATE.fields。許可の無い列はサーバーが 400 で拒否する) */
export type UserBulkUpdateInput = Pick<UpdateUserInput, (typeof USER_BULK_UPDATE.fields)[number]>;
