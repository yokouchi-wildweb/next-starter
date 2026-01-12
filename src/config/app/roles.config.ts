// src/config/app/roles.config.ts
// ダウンストリームでロールを追加する場合はこのファイルを編集してください。
// 追加後は drizzle-kit push でDBスキーマを更新する必要があります。
//
// 注意: コアロール（admin, user）はシステムで保護されており、
// このファイルでは追加ロールのみを定義します。

/**
 * ロールカテゴリ
 * - admin: システム管理権限を持つロール（管理画面のsystem一覧に表示）
 * - user: 一般利用者ロール（管理画面のgeneral一覧に表示）
 */
export type RoleCategory = "admin" | "user";

/**
 * 追加ロールの定義型
 */
export type AdditionalRoleConfig = {
  readonly id: string;
  readonly label: string;
  readonly category: RoleCategory;
  readonly hasProfile: boolean;
  readonly description?: string;
};

/**
 * 追加ロールの定義
 *
 * hasProfile: true の場合は src/features/core/userProfile/entities/tables/ に
 * プロフィールテーブルを定義してください。
 */
export const ADDITIONAL_ROLES: readonly AdditionalRoleConfig[] = [
  // 例: イベントの投稿者
  // {
  //   id: "organizer",
  //   label: "主催者",
  //   category: "user",
  //   hasProfile: true,
  //   description: "イベントを作成・管理できる",
  // },
];
