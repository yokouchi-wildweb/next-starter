// src/features/sample/components/common/SampleFields.tsx

import { FieldValues, type Control, type FieldPath } from "react-hook-form";
import { FormFieldItem } from "@/components/Form/FormFieldItem";
import { SelectInput } from "@/components/Form/Manual";
import { CheckGroupInput } from "@/components/Form/Manual";
import { TextInput } from "@/components/Form/Controlled";
import { NumberInput } from "@/components/Form/Controlled";
import StepperInput from "@/components/Form/Manual/StepperInput";
import { FormField, FormItem, FormControl, FormMessage } from "@/components/_shadcn/form";
import { SwitchInput } from "@/components/Form/Controlled";
import { BooleanRadioGroupInput } from "@/components/Form/Manual";
import { MultiSelectInput } from "@/components/Form/Manual";
import { FileUrlInput } from "@/components/Form/Controlled";
import { Textarea } from "@/components/Form/Controlled";
import type { Options } from "@/types/form";

export type SampleFieldsProps<TFieldValues extends FieldValues> = {
  control: Control<TFieldValues, any, TFieldValues>;
  sampleCategoryOptions?: Options[];
  sampleTagOptions?: Options[];
  /** 既存のメイン画像 URL (編集時のプレビュー用) */
  main_image?: string | null;
  onPendingChange?: (pending: boolean) => void;
  onUploadMain: (file: File) => Promise<string>;
  onDeleteMain?: (url: string) => Promise<void>;
};

export function SampleFields<TFieldValues extends FieldValues>({
  control,
  sampleCategoryOptions,
  sampleTagOptions,
  onPendingChange,
  main_image,
  onUploadMain,
  onDeleteMain,
}: SampleFieldsProps<TFieldValues>) {
  return (
    <>
      <FormFieldItem
        control={control}
        name={"sample_category_id" as FieldPath<TFieldValues>}
        label="サンプルカテゴリ"
        renderInput={(field) => <SelectInput field={field} options={sampleCategoryOptions} />}
      />
      <FormFieldItem
        control={control}
        name={"sample_tag_ids" as FieldPath<TFieldValues>}
        label="サンプルタグ"
        renderInput={(field) => <CheckGroupInput field={field as any} options={sampleTagOptions} />}
      />
      <FormFieldItem
        control={control}
        name={"name" as FieldPath<TFieldValues>}
        label="名前"
        renderInput={(field) => <TextInput field={field} />}
      />
      <FormFieldItem
        control={control}
        name={"number" as FieldPath<TFieldValues>}
        label="数字"
        renderInput={(field) => <NumberInput field={field} />}
      />
      <FormField
        control={control}
        name={"rich_number" as FieldPath<TFieldValues>}
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <StepperInput
                label="リッチナンバー"
                value={typeof field.value === "number" ? field.value : Number(field.value ?? 0)}
                className="w-fit"
                onValueChange={(value) => field.onChange(value)}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name={"switch" as FieldPath<TFieldValues>}
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <SwitchInput field={field} label="スイッチ" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormFieldItem
        control={control}
        name={"radio" as FieldPath<TFieldValues>}
        label="ラジオボタン"
        renderInput={(field) => (
          <BooleanRadioGroupInput field={field} options={[{"value":true,"label":"はい"},{"value":false,"label":"いいえ"}]} />
        )}
      />
      <FormFieldItem
        control={control}
        name={"select" as FieldPath<TFieldValues>}
        label="セレクトボックス（Enum）"
        renderInput={(field) => <SelectInput field={field} options={[{"value":"apple","label":"りんご"},{"value":"orange","label":"オレンジ"},{"value":"berry","label":"いちご"}]} />}
      />
      <FormFieldItem
        control={control}
        name={"multi_select" as FieldPath<TFieldValues>}
        label="マルチセレクトコンボ"
        renderInput={(field) => (
          <MultiSelectInput
            field={field as any}
            options={[{"value":"apple","label":"りんご"},{"value":"orange","label":"オレンジ"},{"value":"cherry","label":"さくらんぼ"}]}
            placeholder="選択してください"
          />
        )}
      />
      <FormFieldItem
        control={control}
        name={"main_image" as FieldPath<TFieldValues>}
        label="メイン画像"
        renderInput={(field) => (
          <FileUrlInput
            field={field as any}
            accept="image/*"
            initialUrl={main_image ?? undefined}
            onUpload={onUploadMain}
            onDelete={onDeleteMain}
            onPendingChange={onPendingChange}
          />
        )}
      />
      <FormFieldItem
        control={control}
        name={"description" as FieldPath<TFieldValues>}
        label="説明文"
        renderInput={(field) => <Textarea field={field} />}
      />
    </>
  );
}