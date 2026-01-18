// src/components/Form/FieldRenderer/types.ts
// FieldRenderer 固有の型定義

// Field/types.ts から共通型を re-export
export type {
  FormInputType,
  FieldDataType,
  FieldDataTypeFirestore,
  FieldOption,
  MediaValidationRule,
  FieldConfig,
} from "@/components/Form/Field/types";

/**
 * フィールドグループ定義（セクション分け用）
 * @see src/features/README.md - FieldGroup（フィールドグループ）
 */
export type FieldGroup = {
  /** グループキー（一意識別子） */
  key: string;
  /** 表示ラベル */
  label: string;
  /** グループに含むフィールド名の配列 */
  fields: string[];
  /** 折りたたみ可能か（デフォルト: false） */
  collapsible?: boolean;
  /** 初期状態で折りたたむか（デフォルト: false） */
  defaultCollapsed?: boolean;
  /** 背景色（CSSカラーコード形式、例: "#f5f5f5", "rgba(0,0,0,0.05)"） */
  bgColor?: string;
};

/**
 * インラインフィールドグループ定義（横並び表示用）
 * 複数フィールドを1つのフィールドのように横並びで表示する
 */
export type InlineFieldGroup = {
  /** グループキー（一意識別子） */
  key: string;
  /** グループラベル（FieldItemのラベルと同じ見た目） */
  label: string;
  /** グループに含むフィールド名の配列（順序通りに横並び表示） */
  fields: string[];
  /** 各フィールドの幅（Tailwindクラス、例: ["w-24", "w-20", "w-20"]）省略時は均等 */
  fieldWidths?: string[];
  /** フィールドが必須かどうか */
  required?: boolean;
  /** 説明テキスト */
  description?: {
    text: string;
    tone?: "muted" | "danger" | "warning" | "success";
    size?: "sm" | "xs";
    placement?: "before" | "after";
  };
};
