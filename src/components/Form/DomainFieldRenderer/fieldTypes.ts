import type { ReactNode } from "react";
import type { FieldPath, FieldValues } from "react-hook-form";
import type { Options } from "@/types/form";
import type { FileValidationRule, SelectedMediaMetadata } from "@/lib/mediaInputSuite";
import type { FormFieldItemDescription } from "@/components/Form/FormFieldItem";

type BaseFieldConfig<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>
> = {
  name: TName;
  label: ReactNode;
  description?: FormFieldItemDescription;
  readOnly?: boolean;
  domainFieldIndex?: number;
};

export type TextFieldConfig<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>
> = BaseFieldConfig<TFieldValues, TName> & {
  type: "text";
};

export type NumberFieldConfig<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>
> = BaseFieldConfig<TFieldValues, TName> & {
  type: "number";
};

export type TextareaFieldConfig<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>
> = BaseFieldConfig<TFieldValues, TName> & {
  type: "textarea";
  placeholder?: string;
};

export type SelectFieldConfig<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>
> = BaseFieldConfig<TFieldValues, TName> & {
  type: "select";
  options?: Options[];
};

export type CheckGroupFieldConfig<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>
> = BaseFieldConfig<TFieldValues, TName> & {
  type: "checkGroup";
  options?: Options[];
};

export type MultiSelectFieldConfig<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>
> = BaseFieldConfig<TFieldValues, TName> & {
  type: "multiSelect";
  options?: Options[];
  placeholder?: string;
};

export type RadioBooleanFieldConfig<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>
> = BaseFieldConfig<TFieldValues, TName> & {
  type: "radioBoolean";
  options: { value: boolean; label: string }[];
};

export type StepperFieldConfig<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>
> = BaseFieldConfig<TFieldValues, TName> & {
  type: "stepper";
};

export type SwitchFieldConfig<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>
> = BaseFieldConfig<TFieldValues, TName> & {
  type: "switch";
  switchLabel?: string;
};

export type MediaUploaderFieldConfig<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>
> = BaseFieldConfig<TFieldValues, TName> & {
  type: "mediaUploader";
  uploadPath: string;
  accept?: string;
  helperText?: string;
  validationRule?: FileValidationRule;
  onMetadataChange?: (metadata: SelectedMediaMetadata) => void;
};

export type DomainFieldRenderConfig<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>
> =
  | TextFieldConfig<TFieldValues, TName>
  | NumberFieldConfig<TFieldValues, TName>
  | TextareaFieldConfig<TFieldValues, TName>
  | SelectFieldConfig<TFieldValues, TName>
  | CheckGroupFieldConfig<TFieldValues, TName>
  | MultiSelectFieldConfig<TFieldValues, TName>
  | RadioBooleanFieldConfig<TFieldValues, TName>
  | StepperFieldConfig<TFieldValues, TName>
  | SwitchFieldConfig<TFieldValues, TName>
  | MediaUploaderFieldConfig<TFieldValues, TName>
  | HiddenFieldConfig<TFieldValues, TName>;

export type HiddenFieldConfig<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>
> = BaseFieldConfig<TFieldValues, TName> & {
  type: "hidden";
};
