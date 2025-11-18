// src/features/gachaMachine/components/common/GachaMachineFields.tsx

import { FieldValues, type Control, type FieldPath } from "react-hook-form";
import { FormFieldItem } from "@/components/Form/FormFieldItem";
import { TextInput } from "@/components/Form/Controlled";
import { FileUrlInput } from "@/components/Form/Controlled";
import { NumberInput } from "@/components/Form/Controlled";
import { DatetimeInput } from "@/components/Form/Controlled";
import { DateInput } from "@/components/Form/Controlled";
import { CheckGroupInput } from "@/components/Form/Manual";
import { Textarea } from "@/components/Form/Controlled";

export type GachaMachineFieldsProps<TFieldValues extends FieldValues> = {
  control: Control<TFieldValues, any, TFieldValues>;
  /** 既存のメイン画像 URL (編集時のプレビュー用) */
  main_image_url?: string | null;
  onPendingChange?: (pending: boolean) => void;
  onUploadMain: (file: File) => Promise<string>;
  onDeleteMain?: (url: string) => Promise<void>;
};

export function GachaMachineFields<TFieldValues extends FieldValues>({
  control,
  onPendingChange,
  main_image_url,
  onUploadMain,
  onDeleteMain,
}: GachaMachineFieldsProps<TFieldValues>) {
  return (
    <>
      <FormFieldItem
        control={control}
        name={"name" as FieldPath<TFieldValues>}
        label="マシン名"
        renderInput={(field) => <TextInput field={field} />}
      />
      <FormFieldItem
        control={control}
        name={"main_image_url" as FieldPath<TFieldValues>}
        label="メイン画像"
        renderInput={(field) => (
          <FileUrlInput
            field={field as any}
            accept="image/*"
            initialUrl={main_image_url ?? undefined}
            onUpload={onUploadMain}
            onDelete={onDeleteMain}
            onPendingChange={onPendingChange}
          />
        )}
      />
      <FormFieldItem
        control={control}
        name={"play_cost" as FieldPath<TFieldValues>}
        label="プレイコスト(Point)"
        renderInput={(field) => <NumberInput field={field} />}
      />
      <FormFieldItem
        control={control}
        name={"sale_start_at" as FieldPath<TFieldValues>}
        label="販売開始日"
        renderInput={(field) => <DatetimeInput field={field} />}
      />
      <FormFieldItem
        control={control}
        name={"sale_end_at" as FieldPath<TFieldValues>}
        label="販売終了日"
        renderInput={(field) => <DateInput field={field} />}
      />
      <FormFieldItem
        control={control}
        name={"daily_limit" as FieldPath<TFieldValues>}
        label="回数制限（1日）"
        renderInput={(field) => <NumberInput field={field} />}
      />
      <FormFieldItem
        control={control}
        name={"user_limit" as FieldPath<TFieldValues>}
        label="回数制限（ユーザー）"
        renderInput={(field) => <NumberInput field={field} />}
      />
      <FormFieldItem
        control={control}
        name={"play_button_type" as FieldPath<TFieldValues>}
        label="プレイボタン"
        renderInput={(field) => (
          <CheckGroupInput
            field={field as any}
            options={[{"value":"single","label":"1回ガチャ"},{"value":"ten","label":"10回ガチャ"},{"value":"hunndred","label":"100回ガチャ"},{"value":"all","label":"残り全てガチャ"}]}
            displayType="checkbox"
          />
        )}
      />
      <FormFieldItem
        control={control}
        name={"description" as FieldPath<TFieldValues>}
        label="説明"
        renderInput={(field) => <Textarea field={field} />}
      />
    </>
  );
}