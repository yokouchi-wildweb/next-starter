// src/components/Form/Field/index.ts

// 型定義
export * from "./types";

// Manual: 低レベルコンポーネント（手動でエラーを渡す、自由なレイアウト向け）
export {
  ManualFieldItem,
  ManualFieldItemGroup,
  FieldController,
} from "./Manual";
export type {
  ManualFieldItemProps,
  ManualFieldItemDescription,
  ManualFieldItemGroupProps,
  ManualFieldItemGroupDescription,
  FieldControllerProps,
} from "./Manual";

// Controlled: 高レベルコンポーネント（React Hook Form 統合、エラー自動取得）
export {
  FieldItem,
  FieldItemGroup,
  MediaFieldItem,
} from "./Controlled";
export type {
  FieldItemProps,
  FieldItemGroupProps,
  MediaFieldItemProps,
} from "./Controlled";
// FieldItemDescription は types.ts からエクスポート済み

// Configured: 設定ベースのコンポーネント（FieldConfig から自動生成）
export {
  ConfiguredField,
  ConfiguredFieldGroup,
  ConfiguredFields,
  ConfiguredMediaField,
  renderInputByFormType,
  hasVisibleInput,
  shouldUseFieldItem,
  isCheckboxArray,
} from "./Configured";
export type {
  ConfiguredFieldProps,
  ConfiguredFieldGroupProps,
  ConfiguredFieldsProps,
  ConfiguredMediaFieldProps,
  MediaFieldConfig,
  MediaHandleEntry,
} from "./Configured";
