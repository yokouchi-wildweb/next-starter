// src/features/setting/components/common/SettingFields.tsx

import { FieldValues, type Control, type FieldPath } from "react-hook-form";
import { FormFieldItem } from "@/components/Form/FormFieldItem";
import { TextInput } from "@/components/Form/controlled";
import { ImageUploaderField } from "@/components/Form/ImageUploaderField";

export type SettingFieldsProps<TFieldValues extends FieldValues> = {
  control: Control<TFieldValues, any, TFieldValues>;
};

export function SettingFields<TFieldValues extends FieldValues>({ control }: SettingFieldsProps<TFieldValues>) {
  return (
    <>
      <FormFieldItem
        control={control}
        name={"developerMotivation" as FieldPath<TFieldValues>}
        label="開発者のやる気 (0-200)"
        renderInput={(field) => <TextInput field={field} type="number" />}
      />
      <ImageUploaderField
        control={control}
        name={"adminHeaderLogoImageUrl" as FieldPath<TFieldValues>}
        label="管理画面ロゴ（ライトモード）"
        uploadPath="admin/header-logo/light"
      />
      <ImageUploaderField
        control={control}
        name={"adminHeaderLogoImageDarkUrl" as FieldPath<TFieldValues>}
        label="管理画面ロゴ（ダークモード）"
        uploadPath="admin/header-logo/dark"
      />
      <FormFieldItem
        control={control}
        name={"adminListPerPage" as FieldPath<TFieldValues>}
        label="一覧表示件数"
        renderInput={(field) => <TextInput field={field} type="number" min={1} max={500} />}
      />
    </>
  );
}
