// src/features/core/user/types/index.ts

import {
  USER_PROVIDER_TYPES,
  USER_ROLES,
  USER_STATUSES,
} from "@/features/core/user/constants";

// 既存の型（constants からの派生型）
export type UserProviderType = (typeof USER_PROVIDER_TYPES)[number];
export type UserRoleType = (typeof USER_ROLES)[number];
export type UserStatus = (typeof USER_STATUSES)[number];

/**
 * 表示名の「予約名」プロバイダ（src/registry/reservedUserNamesRegistry.ts で登録）。
 * users テーブル外で表示名を占有する存在（ボット・NPC・合成ランキング・予約語等）を
 * 一意性チェック (services/server/helpers/nameAvailability.ts) に参加させる。
 *
 * 実装規約:
 * - filterReserved は「渡された正規化済み表示名のうち予約済みのもの」を部分集合で返す
 * - 名前は normalizeUserNameForComparison (utils/userName.ts) で正規化済み。
 *   プロバイダ側の比較対象も同じ正規化で保持・比較すること
 * - advisory lock を保持したトランザクション内から呼ばれるため、高速なローカル DB 参照に限る。
 *   外部 API 等の遅い I/O は事前にテーブルへ同期しておくこと
 * - ctx.executor が渡された場合、Drizzle 参照はそれを使う（同一トランザクションで読むため）
 */
export type ReservedUserNameProvider = {
  /** 識別子（ログ・デバッグ用） */
  key: string;
  filterReserved(
    normalizedNames: string[],
    ctx: { executor?: import("@/lib/crud/drizzle/types").DbExecutor },
  ): Promise<string[]>;
};

// プロフィールフィールド関連の型（userProfile からの再エクスポート）
export {
  CORE_PROFILE_FIELD_TAGS,
  type CoreProfileFieldTag,
  type ProfileFieldConfig,
  type ProfileFieldTag,
} from "@/features/core/userProfile";

// ロール関連の型
export { type RoleCategory, type RoleConfig } from "./role";
