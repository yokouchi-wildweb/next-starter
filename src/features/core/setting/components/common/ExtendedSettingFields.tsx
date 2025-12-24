// src/features/core/setting/components/common/ExtendedSettingFields.tsx
// [GENERATED] このファイルは自動生成されます。直接編集しないでください。
// 生成元: setting-fields.json
// 生成コマンド: pnpm sc:generate

"use client";

import { FieldValues, type Control, type FieldPath } from "react-hook-form";
import { FormFieldItem } from "@/components/Form/FormFieldItem";
import { TextInput, SwitchInput } from "@/components/Form/Controlled";
import { SelectInput } from "@/components/Form/Manual";
import { ControlledMediaUploader } from "@/components/Form/MediaHandler";

const THEMECOLOR_OPTIONS = [
  { value: "blue", label: "ブルー" },
  { value: "green", label: "グリーン" },
  { value: "red", label: "レッド" },
];

export type ExtendedSettingFieldsProps<TFieldValues extends FieldValues> = {
  control: Control<TFieldValues, any, TFieldValues>;
};

export function ExtendedSettingFields<TFieldValues extends FieldValues>({
  control,
}: ExtendedSettingFieldsProps<TFieldValues>) {
  return (
    <>
      <FormFieldItem
        control={control}
        name={"siteTitle" as FieldPath<TFieldValues>}
        label="サイトタイトル"
        description={{
          text: "サイトのタイトルを設定します",
          tone: "muted",
          size: "sm",
        }}
        renderInput={(field) => (
          <TextInput field={field} />
        )}
      />
      <FormFieldItem
        control={control}
        name={"maintenanceMode" as FieldPath<TFieldValues>}
        label="メンテナンスモード"
        description={{
          text: "メンテナンスモードを有効にするとサイトが一時停止します",
          tone: "muted",
          size: "sm",
        }}
        renderInput={(field) => (
          <SwitchInput field={field} />
        )}
      />
      <FormFieldItem
        control={control}
        name={"themeColor" as FieldPath<TFieldValues>}
        label="テーマカラー"
        renderInput={(field) => (
          <SelectInput field={field} options={THEMECOLOR_OPTIONS} />
        )}
      />
      <FormFieldItem
        control={control}
        name={"ogImageUrl" as FieldPath<TFieldValues>}
        label="OGP画像"
        renderInput={(field) => (
          <ControlledMediaUploader
            field={field}
            uploadPath="setting/og"
            accept="image/*"
          />
        )}
      />
    </>
  );
}
