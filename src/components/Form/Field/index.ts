// src/components/Form/Field/index.ts

// 型定義
export * from "./types";

// Manual: 低レベルコンポーネント（手動でエラーを渡す、自由なレイアウト向け）
export {
  ManualField,
  ManualFieldGroup,
  ManualFieldController,
} from "./Manual";
export type {
  ManualFieldProps,
  ManualFieldDescription,
  ManualFieldGroupProps,
  ManualFieldGroupDescription,
  ManualFieldControllerProps,
} from "./Manual";

// Controlled: 高レベルコンポーネント（React Hook Form 統合、エラー自動取得）
export {
  ControlledField,
  ControlledFieldGroup,
  ControlledMediaField,
} from "./Controlled";
export type {
  ControlledFieldProps,
  ControlledFieldGroupProps,
  ControlledMediaFieldProps,
} from "./Controlled";
// FieldItemDescription は types.ts からエクスポート済み

// Configured: 設定ベースのコンポーネント（FieldConfig から自動生成）
export {
  ConfiguredField,
  ConfiguredFieldGroup,
  ConfiguredFields,
  ConfiguredMediaField,
  ConfiguredAsyncRelationField,
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
  ConfiguredAsyncRelationFieldProps,
  MediaFieldConfig,
  MediaHandleEntry,
} from "./Configured";
