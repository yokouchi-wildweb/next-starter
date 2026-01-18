// scripts/role-config/form-inputs.mjs
// プロフィールフィールド用の fieldType -> formInput マッピング
// @see src/features/core/userProfile/constants/fieldTag.ts

/**
 * プロフィールフィールドで利用可能な fieldType と formInput の組み合わせ
 * ドメインJSON の FORM_INPUTS.Neon と同期
 * @see scripts/domain-config/form-inputs.mjs
 */
export const PROFILE_FORM_INPUTS = {
  string: ["text input", "textarea", "date input", "number input", "select", "hidden", "none"],
  integer: ["number input", "stepper input", "select", "radio", "hidden", "none"],
  float: ["number input", "stepper input", "select", "radio", "hidden", "none"],
  boolean: ["checkbox", "radio", "switch input", "hidden", "none"],
  enum: ["select", "radio", "hidden", "none"],
  mediaUploader: ["media uploader", "hidden", "none"],
  date: ["date input", "text input", "hidden", "none"],
  time: ["time input", "text input", "hidden", "none"],
  "timestamp With Time Zone": ["datetime input", "hidden", "none"],
  email: ["email input", "text input", "hidden", "none"],
  password: ["password input", "hidden", "none"],
  bigint: ["number input", "stepper input", "select", "radio", "hidden", "none"],
  "numeric(10,2)": ["number input", "stepper input", "select", "radio", "hidden", "none"],
  uuid: ["text input", "hidden", "none"],
  Point: ["hidden", "none"],
  jsonb: ["hidden", "none"],
  array: ["checkbox", "multi select", "hidden", "none"],
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
