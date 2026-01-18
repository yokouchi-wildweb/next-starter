// src/components/Form/Field/index.ts

// 型定義
export * from "./types";

// Manual: 低レベルコンポーネント（手動でエラーを渡す）
export {
  ManualFieldItem,
  ManualFieldItemGroup,
} from "./Manual";
export type {
  ManualFieldItemProps,
  ManualFieldItemDescription,
  ManualFieldItemGroupProps,
  ManualFieldItemGroupDescription,
} from "./Manual";

// Controlled: 高レベルコンポーネント（React Hook Form 統合、エラー自動取得）
export {
  FieldItem,
  FieldController,
  FieldItemGroup,
  MediaFieldItem,
} from "./Controlled";
export type {
  FieldItemProps,
  FieldItemDescription,
  FieldControllerProps,
  FieldItemGroupProps,
  MediaFieldItemProps,
} from "./Controlled";

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
