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
  avatarUrl: string | null;
  signupIp: string | null;
  /** 管理者がユーザー単位で残す自由記述メモ (機能フラグ enableUserMemo で UI 切り替え) */
  adminMemo: string | null;
  /** 連続ログイン失敗の累積回数 (ロック判定用、詳細: src/config/app/auth-lockout.config.ts) */
  failedLoginCount: number;
  /** 短期ロックの解除予定時刻。null なら短期ロック中ではない */
  lockedUntil: Date | null;
  /** 直近のログイン失敗時刻 (時間窓ベースのカウントリセットに使用) */
  lastFailedLoginAt: Date | null;
  lastAuthenticatedAt: Date | null;
  phoneNumber: string | null;
  phoneVerifiedAt: Date | null;
  metadata: UserMetadata;
  deletedAt: Date | null;
  user_tag_ids?: string[];
};

