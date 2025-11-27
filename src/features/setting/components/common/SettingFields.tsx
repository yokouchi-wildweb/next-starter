// src/features/setting/components/common/SettingFields.tsx

import { FieldValues, type Control, type FieldPath } from "react-hook-form";
import { FormFieldItem } from "@/components/Form/FormFieldItem";
import { TextInput } from "@/components/Form/Controlled";
import { ControlledMediaUploader } from "@/components/Form/MediaHandler";

export type SettingFieldsProps<TFieldValues extends FieldValues> = {
  control: Control<TFieldValues, any, TFieldValues>;
  onUploadingChange?: (uploading: boolean) => void;
  onLightLogoUrlChange?: (url: string | null) => void;
  onDarkLogoUrlChange?: (url: string | null) => void;
  defaultLightLogoUrl?: string | null;
  defaultDarkLogoUrl?: string | null;
  onRegisterLightDelete?: (url: string | null) => void;
  onRegisterDarkDelete?: (url: string | null) => void;
};

export function SettingFields<TFieldValues extends FieldValues>({
  control,
  onUploadingChange,
  onLightLogoUrlChange,
  onDarkLogoUrlChange,
  defaultLightLogoUrl,
  defaultDarkLogoUrl,
  onRegisterLightDelete,
  onRegisterDarkDelete,
}: SettingFieldsProps<TFieldValues>) {
  return (
    <>
      <FormFieldItem
        control={control}
        name={"adminHeaderLogoImageUrl" as FieldPath<TFieldValues>}
        label="管理画面ロゴ（ライトモード）"
        renderInput={(field) => (
          <ControlledMediaUploader
            field={field}
            uploadPath="admin/header-logo/light"
            accept="image/*"
            helperText="ライトモード用のヘッダーロゴを1枚アップロードしてください"
            onUploadingChange={onUploadingChange}
            onUrlChange={onLightLogoUrlChange}
            defaultUrl={defaultLightLogoUrl ?? null}
            onRegisterPendingDelete={onRegisterLightDelete}
          />
        )}
      />
      <FormFieldItem
        control={control}
        name={"adminHeaderLogoImageDarkUrl" as FieldPath<TFieldValues>}
        label="管理画面ロゴ（ダークモード）"
        renderInput={(field) => (
          <ControlledMediaUploader
            field={field}
            uploadPath="admin/header-logo/dark"
            accept="image/*"
            helperText="ダークモード用のヘッダーロゴを1枚アップロードしてください"
            onUploadingChange={onUploadingChange}
            onUrlChange={onDarkLogoUrlChange}
            defaultUrl={defaultDarkLogoUrl ?? null}
            onRegisterPendingDelete={onRegisterDarkDelete}
          />
        )}
      />
      <FormFieldItem
        control={control}
        name={"adminListPerPage" as FieldPath<TFieldValues>}
        label="一覧表示件数"
        renderInput={(field) => <TextInput field={field} type="number" min={1} max={500} />}
      />
      <FormFieldItem
        control={control}
        name={"adminFooterText" as FieldPath<TFieldValues>}
        label="管理画面フッターの表記"
        description={{
          text: "※ フッター設定は変更後にページ再読み込みが必要です。",
          tone: "muted",
          size: "sm",
          placement: "before",
        }}
        renderInput={(field) => (
          <TextInput field={field} placeholder={`© ${new Date().getFullYear()} Wildweb.`} />
        )}
      />
    </>
  );
}
