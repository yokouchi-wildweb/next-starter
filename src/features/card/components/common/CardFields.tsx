// src/features/card/components/common/CardFields.tsx

import {
  FieldValues,
  type Control,
  type FieldPath,
} from "react-hook-form";
import { FormFieldItem } from "@/components/Form/FormFieldItem";
import { FileUrlInput, TextInput, Textarea } from "@/components/Form/controlled";
import { CheckGroupInput, SelectInput } from "@/components/Form/manual";
import type { Options } from "@/types/form";

export type CardFieldsProps<TFieldValues extends FieldValues> = {
  control: Control<TFieldValues, any, TFieldValues>;
  /** 選択肢はロード前でも省略可能 */
  titleOptions?: Options[];
  rarityOptions?: Options[];
  tagOptions?: Options[];
  seriesOptions?: Options[];
  /** 既存のメイン画像 URL (編集時のプレビュー用) */
  mainImageUrl?: string | null;
  onPendingChange?: (pending: boolean) => void;
  onUpload: (file: File) => Promise<string>;
  onDelete?: (url: string) => Promise<void>;
};

export function CardFields<TFieldValues extends FieldValues>({
  control,
  titleOptions = [],
  rarityOptions = [],
  tagOptions = [],
  seriesOptions = [],
  mainImageUrl,
  onPendingChange,
  onUpload,
  onDelete,
}: CardFieldsProps<TFieldValues>) {
  return (
    <>
      <FormFieldItem
        control={control}
        name={"titleId" as FieldPath<TFieldValues>}
        label="タイトル"
        renderInput={(field) => <SelectInput field={field} options={titleOptions} />}
      />
      <FormFieldItem
        control={control}
        name={"rarityId" as FieldPath<TFieldValues>}
        label="レアリティ"
        renderInput={(field) => <SelectInput field={field} options={rarityOptions} />}
      />
      <FormFieldItem
        control={control}
        name={"seriesIds" as FieldPath<TFieldValues>}
        label="シリーズ"
        renderInput={(field) => <CheckGroupInput field={field as any} options={seriesOptions} />}
      />
      <FormFieldItem
        control={control}
        name={"name" as FieldPath<TFieldValues>}
        label="カード名"
        renderInput={(field) => <TextInput field={field} />}
      />
      <FormFieldItem
        control={control}
        name={"modelNumber" as FieldPath<TFieldValues>}
        label="型番"
        renderInput={(field) => <TextInput field={field} />}
      />
      <FormFieldItem
        control={control}
        name={"marketPrice" as FieldPath<TFieldValues>}
        label="市場価格"
        renderInput={(field) => <TextInput field={field} value={field.value ?? ""} type="number" />}
      />
      <FormFieldItem
        control={control}
        name={"pointValue" as FieldPath<TFieldValues>}
        label="還元ポイント"
        renderInput={(field) => <TextInput field={field} value={field.value ?? ""} type="number" />}
      />
      <FormFieldItem
        control={control}
        name={"cardType" as FieldPath<TFieldValues>}
        label="カードタイプ"
        renderInput={(field) => (
          <SelectInput
            field={field}
            options={[
              { value: "real", label: "実在" },
              { value: "virtual", label: "仮想" },
            ]}
          />
        )}
      />
      <FormFieldItem
        control={control}
        name={"state" as FieldPath<TFieldValues>}
        label="状態"
        renderInput={(field) => (
          <SelectInput
            field={field}
            options={[
              { value: "active", label: "有効" },
              { value: "inactive", label: "無効" },
            ]}
          />
        )}
      />
      <FormFieldItem
        control={control}
        name={"tagIds" as FieldPath<TFieldValues>}
        label="タグ"
        renderInput={(field) => <CheckGroupInput field={field as any} options={tagOptions} bookmark />}
      />
      <FormFieldItem
        control={control}
        name={"description" as FieldPath<TFieldValues>}
        label="説明"
        renderInput={(field) => <Textarea field={field} />}
      />
      <FormFieldItem
        control={control}
        name={"mainImageUrl" as FieldPath<TFieldValues>}
        label="メイン画像"
        renderInput={(field) => (
          <FileUrlInput
            field={field as any}
            accept="image/*"
            initialUrl={mainImageUrl ?? undefined}
            onUpload={onUpload}
            onDelete={onDelete}
            onPendingChange={onPendingChange}
          />
        )}
      />
    </>
  );
}
