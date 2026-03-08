// src/features/notificationTemplate/components/common/CreateNotificationTemplateForm.tsx

"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { NotificationTemplateCreateSchema } from "@/features/core/notificationTemplate/entities/schema";
import { NotificationTemplateCreateFields } from "@/features/core/notificationTemplate/entities/form";
import { useCreateNotificationTemplate } from "@/features/core/notificationTemplate/hooks/useCreateNotificationTemplate";
import { NotificationTemplateForm } from "./NotificationTemplateForm";
import { useRouter } from "next/navigation";
import { useToast, useLoadingToast } from "@/lib/toast";
import { err } from "@/lib/errors";
import { buildFormDefaultValues } from "@/components/Form/FieldRenderer";
import domainConfig from "@/features/core/notificationTemplate/domain.json";

type Props = {
  redirectPath?: string;
};

export default function CreateNotificationTemplateForm({ redirectPath = "/" }: Props) {
  const methods = useForm<NotificationTemplateCreateFields>({
    resolver: zodResolver(NotificationTemplateCreateSchema) as Resolver<NotificationTemplateCreateFields>,
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: buildFormDefaultValues(domainConfig) as NotificationTemplateCreateFields,
  });

  const router = useRouter();
  const { showToast } = useToast();
  const { trigger, isMutating } = useCreateNotificationTemplate();
  useLoadingToast(isMutating, "登録中です…");

  const submit = async (data: NotificationTemplateCreateFields) => {
    try {
      await trigger(data);
      showToast("登録しました", "success");
      router.push(redirectPath);
    } catch (error) {
      showToast(err(error, "登録に失敗しました"), "error");
    }
  };

  return (
    <NotificationTemplateForm
      methods={methods}
      onSubmitAction={submit}
      isMutating={isMutating}
      submitLabel="登録"
      onCancel={() => router.push(redirectPath)}
    />
  );
}
