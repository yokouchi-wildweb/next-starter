// src/features/user/entities/model.ts

import type { BaseEntity } from "@/lib/crud";
import type { UserProviderType, UserRoleType, UserStatus } from "@/features/core/user/types";

/** ログイン履歴の最大保持件数 */
export const MAX_LOGIN_HISTORY = 10;

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
  phoneNumber: string | null;
  phoneVerifiedAt: Date | null;
  metadata: UserMetadata;
  deletedAt: Date | null;
  user_tag_ids?: string[];
};

