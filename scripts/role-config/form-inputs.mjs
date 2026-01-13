// scripts/role-config/form-inputs.mjs
// プロフィールフィールド用の fieldType -> formInput マッピング

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
 * プロフィールフィールドのタグ選択肢
 */
export const PROFILE_FIELD_TAGS = [
  { value: "registration", label: "本登録画面" },
  { value: "mypage", label: "マイページ" },
  { value: "admin", label: "管理画面のみ" },
];
