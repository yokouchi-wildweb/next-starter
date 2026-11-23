// src/domains/userTag/components/common/CreateUserTagForm.tsx

"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { UserTagCreateSchema } from "@/domains/core/userTag/entities/schema";
import { UserTagCreateFields } from "@/domains/core/userTag/entities/form";
import { useCreateUserTag } from "@/domains/core/userTag/hooks/useCreateUserTag";
import { UserTagForm } from "./UserTagForm";
import { useRouter } from "@/lib/unsavedGuard";
import { useToast, useLoadingToast } from "@/lib/toast";
import { err } from "@/lib/errors";
import { buildFormDefaultValues } from "@/lib/formSuite";
import { domainDisplay } from "@/domains/core/userTag/entities/display";

type Props = {
  redirectPath?: string;
};

export default function CreateUserTagForm({ redirectPath = "/" }: Props) {
  const methods = useForm<UserTagCreateFields>({
    resolver: zodResolver(UserTagCreateSchema) as Resolver<UserTagCreateFields>,
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: buildFormDefaultValues(domainDisplay) as UserTagCreateFields,
  });

  const router = useRouter();
  const { showToast } = useToast();
  const { trigger, isMutating } = useCreateUserTag();
  useLoadingToast(isMutating, "登録中です…");

  const submit = async (data: UserTagCreateFields) => {
    try {
      await trigger(data);
      showToast("登録しました", "success");
      router.push(redirectPath);
    } catch (error) {
      showToast(err(error, "登録に失敗しました"), "error");
      throw error;
    }
  };

  return (
    <UserTagForm
      methods={methods}
      onSubmitAction={submit}
      isMutating={isMutating}
      submitLabel="登録"
      onCancel={() => router.push(redirectPath)}
    />
  );
}
