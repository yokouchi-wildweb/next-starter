// src/features/user/entities/model.ts

import type { BaseEntity } from "@/lib/crud";
import type { UserProviderType, UserRoleType, UserStatus } from "@/features/core/user/types";

/**
 * ログイン履歴の1レコード
 */
export type UserLoginRecord = {
  ip: string;
  at: string; // ISO日付文字列
};

/**
 * ユーザーメタデータ（JSONB）
 */
export type UserMetadata = {
  signupIp?: string;
  loginHistory?: UserLoginRecord[];
};

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
  metadata: UserMetadata;
  deletedAt: Date | null;
};

