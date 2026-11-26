// src/domains/core/user/entities/user/model.ts

import type { UserProviderType, UserRoleType, UserStatus } from "@/domains/core/user/types";
import type { BaseEntity } from "@/lib/crud";

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
/**
 * ステータス遷移のきっかけ（user_status_histories.trigger の語彙）
 * - self_*: ユーザー本人の操作
 * - signup_*: 登録フロー（仮登録・本登録。退会済みユーザーの再入会含む）
 * - admin_*: 管理者操作
 * - demo_create: デモユーザー作成
 * - security_lockout: ログイン連続失敗による自動ロック
 *
 * 過去分バックフィル（audit_logs からの復元）も同じ語彙にマップして記録する。
 */
export type UserStatusTransitionTrigger =
  | "self_withdraw"
  | "self_pause"
  | "self_reactivate"
  | "signup_pre_register"
  | "signup_activate"
  | "admin_change_status"
  | "admin_soft_delete"
  | "admin_restore"
  | "admin_create"
  | "demo_create"
  | "security_lockout";
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
  /** 連続ログイン失敗の累積回数 (ロック判定用、詳細: src/domains/core/user/config.ts の authLockout) */
  failedLoginCount: number;
  /** 短期ロックの解除予定時刻。null なら短期ロック中ではない */
  lockedUntil: Date | null;
  /** 直近のログイン失敗時刻 (時間窓ベースのカウントリセットに使用) */
  lastFailedLoginAt: Date | null;
  /** 全セッション失効の境界時刻。JWT.iat がこれより前なら認可拒否 */
  sessionsInvalidatedAt: Date | null;
  lastAuthenticatedAt: Date | null;
  phoneNumber: string | null;
  phoneVerifiedAt: Date | null;
  metadata: UserMetadata;
  deletedAt: Date | null;
  user_tag_ids?: string[];
};
