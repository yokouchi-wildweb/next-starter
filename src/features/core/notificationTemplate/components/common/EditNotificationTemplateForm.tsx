// src/features/notificationTemplate/components/common/EditNotificationTemplateForm.tsx

"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { NotificationTemplateUpdateSchema } from "@/features/core/notificationTemplate/entities/schema";
import type { NotificationTemplateUpdateFields } from "@/features/core/notificationTemplate/entities/form";
import type { NotificationTemplate } from "@/features/core/notificationTemplate/entities";
import { useUpdateNotificationTemplate } from "@/features/core/notificationTemplate/hooks/useUpdateNotificationTemplate";
import { useSearchNotificationTemplate } from "@/features/core/notificationTemplate/hooks/useSearchNotificationTemplate";
import { NotificationTemplateForm } from "./NotificationTemplateForm";
import { useRouter } from "next/navigation";
import { useToast, useLoadingToast } from "@/lib/toast";
import { err } from "@/lib/errors";
import { buildFormDefaultValues } from "@/components/Form/FieldRenderer";
import { useItemNavigator } from "@/components/AppFrames/Admin/Elements/ItemNavigator";
import { getAdminPaths } from "@/lib/crud/utils/paths";
import domainConfig from "@/features/core/notificationTemplate/domain.json";

const adminPaths = getAdminPaths(domainConfig.plural);

type Props = {
  notificationTemplate: NotificationTemplate;
  redirectPath?: string;
};

export default function EditNotificationTemplateForm({ notificationTemplate, redirectPath = "/" }: Props) {
  const methods = useForm<NotificationTemplateUpdateFields>({
    resolver: zodResolver(NotificationTemplateUpdateSchema) as Resolver<NotificationTemplateUpdateFields>,
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: buildFormDefaultValues(domainConfig, notificationTemplate) as NotificationTemplateUpdateFields,
  });

  const router = useRouter();
  const { showToast } = useToast();
  const { trigger, isMutating } = useUpdateNotificationTemplate();
  const { data: items } = useSearchNotificationTemplate({ limit: 10 });

  const { navigator, isSwitching } = useItemNavigator({
    items,
    currentItem: notificationTemplate,
    getPath: adminPaths.edit,
    methods,
    updateTrigger: trigger,
    isMutating,
  });

  useLoadingToast(isMutating, isSwitching ? "アイテムを切り替え中" : "更新中です…");

  const submit = async (data: NotificationTemplateUpdateFields) => {
    try {
      await trigger({ id: notificationTemplate.id, data });
      showToast("更新しました", "success");
      router.push(redirectPath);
    } catch (error) {
      showToast(err(error, "更新に失敗しました"), "error");
    }
  };

  return (
    <>
      {navigator}
      <NotificationTemplateForm
        methods={methods}
        onSubmitAction={submit}
        isMutating={isMutating}
        submitLabel="更新"
        onCancel={() => router.push(redirectPath)}
      />
    </>
  );
}
