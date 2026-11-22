// src/lib/formSuite — フォームの組み立て一式の入口(AppForm・欄の枠 Field・Controlled の入力・FieldRenderer・AutoSave・FormActions)。説明: README.md
// "use client" は付けない(印は要るファイルだけが持つ)。入力部品そのもの(Manual)は棚 @/components/Input/<部品>

// 入れ物
export { AppForm, useAppFormError, useAppFormMedia } from "./AppForm";
export type { AppFormProps, SubmitErrorDisplay } from "./AppForm";
export { FormActions } from "./FormActions";

// react-hook-form の型と欄の種別
export * from "./types";

// 欄の枠(Manual / Controlled / Configured)と設定の型
export * from "./Field";
export {
  CustomFormInput,
  FormInputsProvider,
  resolveFormInputs,
  useCustomFormInput,
  useCustomFormInputs,
} from "./Field/Configured/customInputs";
export type { FormInputPlug, ResolvedFormInput } from "./Field/Configured/customInputs";

// Controlled の入力(react-hook-form の field を受ける。名前は Controlled + 棚の部品の名前)
export * from "./inputs";

// 設定から欄を並べる
export { FieldRenderer } from "./FieldRenderer/FieldRenderer";
export type { FieldRendererProps } from "./FieldRenderer/FieldRenderer";
export { FieldGroupSection } from "./FieldRenderer/FieldGroupSection";
export type { FieldGroupSectionProps } from "./FieldRenderer/FieldGroupSection";
export { buildFormDefaultValues } from "./FieldRenderer/defaultValueBuilder";
export { UNGROUPED_GROUP_KEY } from "./FieldRenderer/types";
export type { FieldGroup, GroupContentMap, InlineFieldGroup, InsertFieldsMap, MediaState } from "./FieldRenderer/types";

// 関連の選択肢(写しの relations → FieldRenderer の insertBefore)
export { useRelationOptions } from "./useRelationOptions";
export type { UseRelationOptionsResult } from "./useRelationOptions";

// 自動保存
export * from "./AutoSave";
