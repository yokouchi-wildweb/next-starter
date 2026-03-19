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
import { useToast } from "@/lib/toast";
import { err } from "@/lib/errors";
import { getZodDefaults } from "@/lib/zod";
import { settingExtendedSchema } from "../../setting.extended";

// 統合されたフォーム型
type CombinedSettingUpdateFields = SettingUpdateFields & SettingExtendedUpdateFields;

type Props = {
  setting: Setting;
  redirectPath?: string;
};

export default function EditSettingForm({ setting, redirectPath = "/" }: Props) {
  const extendedDefaults = getZodDefaults(settingExtendedSchema);

  const methods = useForm<CombinedSettingUpdateFields>({
    resolver: zodResolver(SettingCombinedUpdateSchema),
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: {
      // 基本設定項目
      adminListPerPage: setting.adminListPerPage ?? 100,
      // 拡張設定項目（setting.extended.ts から取得したデフォルト値を既存値で上書き）
      ...extendedDefaults,
      ...Object.fromEntries(
        Object.keys(extendedDefaults).map((key) => [
          key,
          (setting as unknown as Record<string, unknown>)[key] ?? extendedDefaults[key as keyof typeof extendedDefaults],
        ]),
      ),
    } as CombinedSettingUpdateFields,
  });

  const router = useRouter();
  const { showToast } = useToast();
  const { trigger, isMutating } = useUpdateSetting();

  const submit = async (data: CombinedSettingUpdateFields) => {
    showToast({ message: "更新中です…", mode: "persistent" });
    try {
      await trigger({ id: setting.id, data });
      showToast("設定を更新しました", "success");
      router.push(redirectPath);
    } catch (error) {
      showToast(err(error, "更新に失敗しました"), "error");
    }
  };

  return (
    <SettingForm
      methods={methods}
      onSubmitAction={submit}
      isMutating={isMutating}
      submitLabel="更新"
    />
  );
}
