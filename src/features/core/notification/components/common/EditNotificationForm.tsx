// src/features/notification/components/common/EditNotificationForm.tsx

"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { NotificationUpdateSchema } from "@/features/core/notification/entities/schema";
import type { NotificationUpdateFields } from "@/features/core/notification/entities/form";
import type { Notification } from "@/features/core/notification/entities";
import { useUpdateNotification } from "@/features/core/notification/hooks/useUpdateNotification";
import { useSearchNotification } from "@/features/core/notification/hooks/useSearchNotification";
import { NotificationForm } from "./NotificationForm";
import { useRouter } from "next/navigation";
import { useToast, useLoadingToast } from "@/lib/toast";
import { err } from "@/lib/errors";
import { buildFormDefaultValues } from "@/components/Form/FieldRenderer";
import { useItemNavigator } from "@/components/AppFrames/Admin/Elements/ItemNavigator";
import { getAdminPaths } from "@/lib/crud/utils/paths";
import domainConfig from "@/features/core/notification/domain.json";

const adminPaths = getAdminPaths(domainConfig.plural);

type Props = {
  notification: Notification;
  redirectPath?: string;
};

export default function EditNotificationForm({ notification, redirectPath = "/" }: Props) {
  const methods = useForm<NotificationUpdateFields>({
    resolver: zodResolver(NotificationUpdateSchema) as Resolver<NotificationUpdateFields>,
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: buildFormDefaultValues(domainConfig, notification) as NotificationUpdateFields,
  });

  const router = useRouter();
  const { showToast } = useToast();
  const { trigger, isMutating } = useUpdateNotification();
  const { data: items } = useSearchNotification({ limit: 10 });

  const { navigator, isSwitching } = useItemNavigator({
    items,
    currentItem: notification,
    getPath: adminPaths.edit,
    methods,
    updateTrigger: trigger,
    isMutating,
  });

  useLoadingToast(isMutating, isSwitching ? "アイテムを切り替え中" : "更新中です…");

  const submit = async (data: NotificationUpdateFields) => {
    try {
      await trigger({ id: notification.id, data });
      showToast("更新しました", "success");
      router.push(redirectPath);
    } catch (error) {
      showToast(err(error, "更新に失敗しました"), "error");
    }
  };

  return (
    <>
      {navigator}
      <NotificationForm
        methods={methods}
        onSubmitAction={submit}
        isMutating={isMutating}
        submitLabel="更新"
        onCancel={() => router.push(redirectPath)}
      />
    </>
  );
}
