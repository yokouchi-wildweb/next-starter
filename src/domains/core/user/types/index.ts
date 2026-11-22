// src/domains/core/user/types/index.ts

import {
  USER_PROVIDER_TYPES,
  USER_ROLES,
  USER_STATUSES,
} from "@/domains/core/user/constants";

// 既存の型（constants からの派生型）
export type UserProviderType = (typeof USER_PROVIDER_TYPES)[number];
export type UserRoleType = (typeof USER_ROLES)[number];
export type UserStatus = (typeof USER_STATUSES)[number];

/**
 * 表示名の「予約名」プロバイダ（src/domains/core/user/reservedNames/<名前>.ts の export const provider）。
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
    ctx: { executor?: import("@/lib/crud/server").DbExecutor },
  ): Promise<string[]>;
};

// プロフィールフィールド関連の型（userProfile からの再エクスポート）
export {
  CORE_PROFILE_FIELD_TAGS,
  type CoreProfileFieldTag,
  type ProfileFieldConfig,
  type ProfileFieldTag,
} from "@/domains/core/userProfile";

// ロール関連の型
export { type RoleCategory, type CoreRoleOverride, type RoleConfig, type RoleOverride } from "./role";

/**
 * 管理一覧の一括操作の項目の access(表示の出し分け。権限の守りは API の側)。
 * roles に今の管理者のロールがあれば出す(useAdminBulkActionCan)。user 以外の管理一覧の受け口も同じ形を使う
 */
export type AdminBulkActionAccess = { roles: readonly UserRoleType[] };

/**
 * user の管理一覧の一括操作の項目(src/domains/core/user/adminBulkActions/<名前>.tsx の export const bulkAction)。
 * lists は "general"(一般)/ "managerial"(システム管理者)/ "demo"(デモ)。作り方: src/lib/tableSuite/README.md「一括操作の受け口」
 */
export type UserAdminBulkActionItem = import("@/lib/tableSuite").BulkActionItem<
  import("@/domains/core/user/entities").User,
  AdminBulkActionAccess
> & {
  /** この機能(門番の規則の名前)が閉なら出さない(useGate、useUserAdminBulkActions が見る。機能の入切は門番の持ち物、D35) */
  feature?: import("@/featureGate").FeatureName;
};

/**
 * 管理のユーザー管理モーダル(AdminUserManageModal)に足すタブ(受け口 adminManageTabs:
 * src/domains/core/user/adminManageTabs/<名前>.tsx の export const tab)。上流の 6 つのタブの後ろに order → key の順で並ぶ。
 * key は上流のタブの value(summary / auth / status / role / delete / history)と重ねない(重なる項目は出さない)
 */
export type UserAdminManageTabItem = {
  /** タブの識別子(TabbedModal の value) */
  key: string;
  /** タブの見出し */
  label: import("react").ReactNode;
  /** 並び(小さいほど前。省略 = 0)。同じなら key の順 */
  order?: number;
  /** この機能(門番の規則の名前)が閉なら出さない(useGate) */
  feature?: import("@/featureGate").FeatureName;
  /** タブの中身。モーダルが開いている利用者と、モーダルを閉じる関数を受ける */
  Content: import("react").ComponentType<{
    user: import("@/domains/core/user/entities").User;
    onClose: () => void;
  }>;
};

// マイページのメニューの項目の型(受け口 mypageMenu。書き方: src/domains/core/user/Extension.md「マイページのメニュー(拡張点 mypageMenu)」)
export type {
  MypageMenuAction,
  MypageMenuVariant,
  MypageMenuLinkItem,
  MypageMenuActionItem,
  MypageMenuItem,
  MypageMenuItemOverride,
  MypageMenuActionBinding,
  MypageMenuBuiltLinkRow,
  MypageMenuBuiltActionRow,
  MypageMenuBuiltRow,
  MypageMenuHiddenEntry,
  BuildMypageMenuInput,
  BuiltMypageMenu,
} from "./mypageMenu";
