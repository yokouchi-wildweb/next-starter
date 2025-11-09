// src/features/bar/components/common/BarFields.tsx

import { FieldValues, type Control, type FieldPath } from "react-hook-form";
import { FormFieldItem } from "@/components/Form/FormFieldItem";
import { CheckGroupInput, SelectInput } from "@/components/Form/manual";
import { FileUrlInput, TextInput, Textarea } from "@/components/Form/controlled";
import type { Options } from "@/types/form";

export type BarFieldsProps<TFieldValues extends FieldValues> = {
  control: Control<TFieldValues, any, TFieldValues>;
  titleOptions?: Options[];
  cardRarityOptions?: Options[];
  cardTagOptions?: Options[];
  seriesOptions?: Options[];
  /** 既存の画像 URL (編集時のプレビュー用) */
  mainImageUrl?: string | null;
  onPendingChange?: (pending: boolean) => void;
  onUploadMain: (file: File) => Promise<string>;
  onDeleteMain?: (url: string) => Promise<void>;
};

export function BarFields<TFieldValues extends FieldValues>({
  control,
  titleOptions,
  cardRarityOptions,
  cardTagOptions,
  seriesOptions,
  onPendingChange,
  mainImageUrl,
  onUploadMain,
  onDeleteMain,
}: BarFieldsProps<TFieldValues>) {
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
        renderInput={(field) => <SelectInput field={field} options={cardRarityOptions} />}
      />
      <FormFieldItem
        control={control}
        name={"tagIds" as FieldPath<TFieldValues>}
        label="カードタグ"
        renderInput={(field) => <CheckGroupInput field={field as any} options={cardTagOptions} />}
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
        renderInput={(field) => <TextInput field={field} type="number" value={field.value ?? ""} />}
      />
      <FormFieldItem
        control={control}
        name={"pointValue" as FieldPath<TFieldValues>}
        label="ポイント還元値"
        renderInput={(field) => <TextInput field={field} type="number" value={field.value ?? ""} />}
      />
      <FormFieldItem
        control={control}
        name={"cardType" as FieldPath<TFieldValues>}
        label="種別"
        renderInput={(field) => <SelectInput field={field} options={[{"value":"real","label":"実在"},{"value":"virtual","label":"仮想"}]} />}
      />
      <FormFieldItem
        control={control}
        name={"state" as FieldPath<TFieldValues>}
        label="状態"
        renderInput={(field) => <SelectInput field={field} options={[{"value":"active","label":"有効"},{"value":"inactive","label":"無効"}]} />}
      />
      <FormFieldItem
        control={control}
        name={"description" as FieldPath<TFieldValues>}
        label="説明文"
        renderInput={(field) => <Textarea field={field} />}
      />
      <FormFieldItem
        control={control}
        name={"mainImageUrl" as FieldPath<TFieldValues>}
        label="画像"
        renderInput={(field) => (
          <FileUrlInput
            field={field as any}
            accept="image/*"
            initialUrl={mainImageUrl ?? undefined}
            onUpload={onUploadMain}
            onDelete={onDeleteMain}
            onPendingChange={onPendingChange}
          />
        )}
      />
    </>
  );
}