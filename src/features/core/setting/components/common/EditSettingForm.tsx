// src/features/setting/components/common/EditSettingForm.tsx

"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SettingCombinedUpdateSchema } from "@/features/core/setting/entities";
import type { SettingUpdateFields } from "@/features/core/setting/entities/form";
import type { SettingExtendedUpdateFields } from "@/features/core/setting/entities/form.extended";
import type { Setting } from "@/features/core/setting/entities";

import { useUpdateSetting } from "@/features/core/setting/hooks/useUpdateSetting";
import { SettingForm } from "./SettingForm";
import { useRouter } from "next/navigation";
import { useAppToast } from "@/hooks/useAppToast";
import { err } from "@/lib/errors";
import { buildFormDefaultValues } from "@/components/Form/DomainFieldRenderer";
import settingFieldsJson from "../../setting-fields.json";

// 統合されたフォーム型
type CombinedSettingUpdateFields = SettingUpdateFields & SettingExtendedUpdateFields;

type Props = {
  setting: Setting;
  redirectPath?: string;
};

export default function EditSettingForm({ setting, redirectPath = "/" }: Props) {
  // 拡張設定項目のdefaultValuesを動的に構築
  const extendedDefaults = buildFormDefaultValues(
    { fields: settingFieldsJson.fields },
    setting as unknown as Record<string, unknown>,
  );

  const methods = useForm<CombinedSettingUpdateFields>({
    resolver: zodResolver(SettingCombinedUpdateSchema),
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: {
      // 基本設定項目
      adminHeaderLogoImageUrl: setting.adminHeaderLogoImageUrl ?? "",
      adminHeaderLogoImageDarkUrl: setting.adminHeaderLogoImageDarkUrl ?? "",
      adminListPerPage: setting.adminListPerPage ?? 100,
      // 拡張設定項目（setting-fields.json から動的に構築）
      ...extendedDefaults,
    } as CombinedSettingUpdateFields,
  });

  const router = useRouter();
  const { showAppToast, hideAppToast } = useAppToast();
  const { trigger, isMutating } = useUpdateSetting();

  const submit = async (data: CombinedSettingUpdateFields) => {
    showAppToast({ message: "更新中です…", mode: "persistent" });
    try {
      await trigger({ id: setting.id, data });
      showAppToast("設定を更新しました", "success");
      router.push(redirectPath);
    } catch (error) {
      showAppToast(err(error, "更新に失敗しました"), "error");
    }
  };

  return (
    <SettingForm
      methods={methods}
      onSubmitAction={submit}
      isMutating={isMutating}
      submitLabel="更新"
      processingLabel="処理中..."
    />
  );
}
