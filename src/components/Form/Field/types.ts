// src/components/Form/Field/types.ts
// フィールド設定の型定義

import type { ReactNode } from "react";
import type { FileValidationRule } from "@/lib/mediaInputSuite";
import type { ParaProps } from "@/components/TextBlocks/Para";

/**
 * フォーム入力種別（domain.json formInput）
 * @see src/features/README.md - FormInput
 */
export type FormInputType =
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
export type FieldDataType =
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
export type FieldDataTypeFirestore =
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
export type FieldOption = {
  value: string | number | boolean;
  label: string;
};

/**
 * MediaUploader 用バリデーションルール
 */
export type MediaValidationRule = FileValidationRule;

/**
 * フィールド設定（domain.json の Field と完全互換）
 * @see src/features/README.md - Field（フィールド定義）
 */
export type FieldConfig = {
  // === 基本プロパティ ===
  /** フィールド名（snake_case） */
  name: string;
  /** 表示ラベル */
  label: string;
  /** データ型 */
  fieldType?: FieldDataType | FieldDataTypeFirestore | string;
  /** フォーム入力種別 */
  formInput: FormInputType;
  /** 必須かどうか */
  required?: boolean;
  /** 読み取り専用（textInput, numberInput, textarea のみ） */
  readonly?: boolean;
  /** デフォルト値 */
  defaultValue?: unknown;
  /** 選択肢（select, radio, checkbox, multiSelect で使用） */
  options?: readonly FieldOption[] | FieldOption[];
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
  validationRule?: MediaValidationRule;
  /** ヘルパーテキスト */
  helperText?: string;
  /** メタデータを別フィールドに保存 */
  metadataBinding?: Record<string, string>;
};

// ============================================
// フィールドコンポーネント共通Props
// ============================================

/**
 * 説明テキストの設定
 */
export type FieldItemDescription = {
  /** 説明テキスト */
  text: ReactNode;
  /** テキストのトーン */
  tone?: ParaProps["tone"];
  /** テキストのサイズ */
  size?: ParaProps["size"];
  /** 表示位置（入力の前 or 後） */
  placement?: "before" | "after";
};

/**
 * フィールド表示の共通オプション
 */
export type FieldDisplayOptions = {
  /** FormItem全体に適用するクラス名 */
  className?: string;
  /** 内部のInputコンポーネントに適用するクラス名 */
  inputClassName?: string;
  /** ラベルを視覚的に非表示にする */
  hideLabel?: boolean;
  /** エラーメッセージを非表示にする */
  hideError?: boolean;
};

/**
 * 必須マーク関連の共通オプション
 */
export type RequiredMarkOptions = {
  /** フィールドが必須かどうか */
  required?: boolean;
  /** カスタム必須マーク（省略時はデフォルトの赤い * を表示） */
  requiredMark?: ReactNode;
  /** 必須マークの位置（デフォルト: "after"） */
  requiredMarkPosition?: "before" | "after";
};

/**
 * フィールド共通Props（表示 + 必須マーク + 説明）
 * FieldItem, MediaFieldItem, ConfiguredField 等で共通使用
 */
export type FieldCommonProps = FieldDisplayOptions & RequiredMarkOptions & {
  /** 説明テキスト */
  description?: FieldItemDescription;
};
