// src/features/setting/components/common/EditSettingForm.tsx

"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SettingUpdateSchema } from "@/features/setting/entities/schema";
import { SettingUpdateFields } from "@/features/setting/entities/form";
import type { Setting } from "@/features/setting/entities";
import { useUpdateSetting } from "@/features/setting/hooks/useUpdateSetting";
import { SettingForm } from "./SettingForm";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { err } from "@/lib/errors";

type Props = {
  setting: Setting;
  redirectPath?: string;
};

export default function EditSettingForm({ setting, redirectPath = "/" }: Props) {
  const methods = useForm<SettingUpdateFields>({
    resolver: zodResolver(SettingUpdateSchema),
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: {
      adminHeaderLogoImageUrl: setting.adminHeaderLogoImageUrl ?? "",
      adminHeaderLogoImageDarkUrl: setting.adminHeaderLogoImageDarkUrl ?? "",
      adminListPerPage: setting.adminListPerPage ?? 100,
      adminFooterText: setting.adminFooterText ?? "",
    },
  });

  const router = useRouter();
  const { trigger, isMutating } = useUpdateSetting();

  const submit = async (data: SettingUpdateFields) => {
    try {
      await trigger({ id: setting.id, data });
      toast.success("設定を更新しました");
      router.push(redirectPath);
    } catch (error) {
      toast.error(err(error, "更新に失敗しました"));
    }
  };

  return (
    <SettingForm
      methods={methods}
      onSubmitAction={submit}
      isMutating={isMutating}
      submitLabel="更新"
      processingLabel="更新中..."
    />
  );
}
