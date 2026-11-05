// src/features/core/userProfile/constants/fieldTags.mjs
// プロフィールフィールドのタグの値（正）。画面（fieldTag.ts が型を付けて再 export）と
// role:generate の検査（scripts/structure/role/checks/）の両方がここを読むので .mjs に置く

/**
 * コアタグ（システム必須、削除不可）
 * - adminEdit: 管理者がプロフィールを編集
 * - registration: 本登録画面で表示
 * - selfEdit: ユーザー自身がプロフィールを編集
 */
export const CORE_PROFILE_FIELD_TAGS = /** @type {const} */ (["adminEdit", "registration", "selfEdit"]);

/**
 * 追加タグ（プロジェクト固有、削除可能）
 * - notification: 通知設定で使用
 */
export const EXTRA_PROFILE_FIELD_TAGS = /** @type {const} */ ([
  // 例: 通知設定用
  "notification",
]);

/**
 * 全タグ（コア + 追加）
 */
export const PROFILE_FIELD_TAGS = /** @type {const} */ ([...CORE_PROFILE_FIELD_TAGS, ...EXTRA_PROFILE_FIELD_TAGS]);
