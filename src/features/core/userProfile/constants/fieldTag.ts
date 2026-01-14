// src/features/core/userProfile/constants/fieldTag.ts
// プロフィールフィールドのタグ定数

/**
 * コアタグ（システム必須、削除不可）
 * - adminEdit: 管理者がプロフィールを編集
 * - registration: 本登録画面で表示
 * - selfEdit: ユーザー自身がプロフィールを編集
 */
export const CORE_PROFILE_FIELD_TAGS = ["adminEdit", "registration", "selfEdit"] as const;

/**
 * 追加タグ（プロジェクト固有、削除可能）
 * - notification: 通知設定で使用
 */
export const EXTRA_PROFILE_FIELD_TAGS = [
  // 例: 通知設定用
  "notification"
] as const;

/**
 * 全タグ（コア + 追加）
 */
export const PROFILE_FIELD_TAGS = [
  ...CORE_PROFILE_FIELD_TAGS,
  ...EXTRA_PROFILE_FIELD_TAGS,
] as const;
