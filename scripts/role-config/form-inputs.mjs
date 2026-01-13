// scripts/role-config/form-inputs.mjs
// プロフィールフィールド用の fieldType -> formInput マッピング
// @see src/features/core/userProfile/constants/fieldTag.ts

/**
 * プロフィールフィールドで利用可能な fieldType と formInput の組み合わせ
 * ドメインJSON の FORM_INPUTS をベースに、プロフィールで必要なもののみ抽出
 */
export const PROFILE_FORM_INPUTS = {
  string: ["text input", "textarea", "select", "hidden"],
  integer: ["number input", "stepper input", "select", "hidden"],
  boolean: ["checkbox", "radio", "switch input", "hidden"],
  enum: ["select", "radio", "hidden"],
  "timestamp With Time Zone": ["datetime input", "hidden"],
  array: ["checkbox", "multi select", "hidden"],
};

/**
 * コアタグ（システム必須、削除不可）
 * @see src/features/core/userProfile/constants/fieldTag.ts - CORE_PROFILE_FIELD_TAGS
 */
export const CORE_PROFILE_FIELD_TAGS = [
  { value: "admin", label: "管理画面のみ" },
  { value: "registration", label: "本登録画面" },
  { value: "mypage", label: "マイページ" },
];

/**
 * 追加タグ（プロジェクト固有、削除可能）
 * @see src/features/core/userProfile/constants/fieldTag.ts - EXTRA_PROFILE_FIELD_TAGS
 */
export const EXTRA_PROFILE_FIELD_TAGS = [
  { value: "notification", label: "通知設定" },
];

/**
 * 全タグ（コア + 追加）
 * @see src/features/core/userProfile/constants/fieldTag.ts - PROFILE_FIELD_TAGS
 */
export const PROFILE_FIELD_TAGS = [
  ...CORE_PROFILE_FIELD_TAGS,
  ...EXTRA_PROFILE_FIELD_TAGS,
];
