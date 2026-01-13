// src/components/Form/DomainFieldRenderer/types.ts
// domain.json フィールド定義の型（CRUD・フォーム共通）

import type { FileValidationRule } from "@/lib/mediaInputSuite";

/**
 * フォーム入力種別（domain.json formInput）
 * @see src/features/README.md - FormInput
 */
export type DomainFormInput =
  | "textInput"
  | "numberInput"
  | "textarea"
  | "select"
  | "multiSelect"
  | "radio"
  | "checkbox"
  | "stepperInput"
  | "switchInput"
  | "dateInput"
  | "timeInput"
  | "datetimeInput"
  | "emailInput"
  | "passwordInput"
  | "mediaUploader"
  | "hidden"
  | "none";

/**
 * フィールドの型（domain.json fieldType - Neon）
 * @see src/features/README.md - FieldType（Neon）
 */
export type DomainFieldType =
  | "string"
  | "integer"
  | "float"
  | "boolean"
  | "enum"
  | "date"
  | "time"
  | "timestamp With Time Zone"
  | "email"
  | "password"
  | "bigint"
  | `numeric(${number},${number})`
  | "uuid"
  | "Point"
  | "jsonb"
  | "array"
  | "mediaUploader";

/**
 * フィールドの型（domain.json fieldType - Firestore）
 * @see src/features/README.md - FieldType（Firestore）
 */
export type DomainFieldTypeFirestore =
  | "string"
  | "number"
  | "boolean"
  | "timestamp"
  | "email"
  | "password"
  | "array"
  | "geopoint"
  | "reference"
  | "map"
  | "null"
  | "mediaUploader";

/**
 * 選択肢の型（select, radio, checkbox, multiSelect で使用）
 */
export type DomainFieldOption = {
  value: string | number | boolean;
  label: string;
};

/**
 * MediaUploader 用バリデーションルール
 */
export type DomainMediaValidationRule = FileValidationRule;

/**
 * domain.json フィールド定義（domain.json の Field と完全互換）
 * @see src/features/README.md - Field（フィールド定義）
 */
export type DomainJsonField = {
  // === 基本プロパティ ===
  /** フィールド名（snake_case） */
  name: string;
  /** 表示ラベル */
  label: string;
  /** データ型 */
  fieldType?: DomainFieldType | DomainFieldTypeFirestore | string;
  /** フォーム入力種別 */
  formInput: DomainFormInput;
  /** 必須かどうか */
  required?: boolean;
  /** 読み取り専用（textInput, numberInput, textarea のみ） */
  readonly?: boolean;
  /** デフォルト値 */
  defaultValue?: unknown;
  /** 選択肢（select, radio, checkbox, multiSelect で使用） */
  options?: readonly DomainFieldOption[] | DomainFieldOption[];
  /** radio/checkbox の表示スタイル */
  displayType?: "standard" | "bookmark" | string;
  /** プレースホルダー */
  placeholder?: string;
  // === MediaUploader 追加プロパティ ===
  /** アップロード先パス（例: sample/main） */
  uploadPath?: string;
  /** ハンドラ識別子（camelCase） */
  slug?: string;
  /** 許可ファイル種別 */
  mediaTypePreset?: "images" | "videos" | "imagesAndVideos" | "all";
  /** accept 属性値（例: image/*,video/*） */
  accept?: string;
  /** バリデーション設定 */
  validationRule?: DomainMediaValidationRule;
  /** ヘルパーテキスト */
  helperText?: string;
  /** メタデータを別フィールドに保存 */
  metadataBinding?: Record<string, string>;
  // === 内部用 ===
  /** フィールドインデックス（内部使用） */
  domainFieldIndex?: number;
};
