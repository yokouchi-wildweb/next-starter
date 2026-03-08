// src/features/notification/components/common/CreateNotificationForm.tsx

"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { NotificationCreateSchema } from "@/features/core/notification/entities/schema";
import { NotificationCreateFields } from "@/features/core/notification/entities/form";
import { useCreateNotification } from "@/features/core/notification/hooks/useCreateNotification";
import { NotificationForm } from "./NotificationForm";
import { useRouter } from "next/navigation";
import { useToast, useLoadingToast } from "@/lib/toast";
import { err } from "@/lib/errors";
import { buildFormDefaultValues } from "@/components/Form/FieldRenderer";
import domainConfig from "@/features/core/notification/domain.json";

type Props = {
  redirectPath?: string;
};

export default function CreateNotificationForm({ redirectPath = "/" }: Props) {
  const methods = useForm<NotificationCreateFields>({
    resolver: zodResolver(NotificationCreateSchema) as Resolver<NotificationCreateFields>,
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: buildFormDefaultValues(domainConfig) as NotificationCreateFields,
  });

  const router = useRouter();
  const { showToast } = useToast();
  const { trigger, isMutating } = useCreateNotification();
  useLoadingToast(isMutating, "登録中です…");

  const submit = async (data: NotificationCreateFields) => {
    try {
      await trigger(data);
      showToast("登録しました", "success");
      router.push(redirectPath);
    } catch (error) {
      showToast(err(error, "登録に失敗しました"), "error");
    }
  };

  return (
    <NotificationForm
      methods={methods}
      onSubmitAction={submit}
      isMutating={isMutating}
      submitLabel="登録"
      onCancel={() => router.push(redirectPath)}
    />
  );
}
