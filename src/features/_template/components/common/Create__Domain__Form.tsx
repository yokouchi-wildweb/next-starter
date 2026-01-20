// src/features/__domain__/components/common/Create__Domain__Form.tsx

"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { __Domain__CreateSchema } from "@/features/__domain__/entities/schema";
import { __Domain__CreateFields } from "@/features/__domain__/entities/form";
import { useCreate__Domain__ } from "@/features/__domain__/hooks/useCreate__Domain__";
import { __Domain__Form } from "./__Domain__Form";
import { useRouter } from "next/navigation";
import { useToast, useLoadingToast } from "@/lib/toast";
import { err } from "@/lib/errors";
import { buildFormDefaultValues } from "@/components/Form/FieldRenderer";
import domainConfig from "@/features/__domain__/domain.json";

type Props = {
  redirectPath?: string;
};

export default function Create__Domain__Form({ redirectPath = "/" }: Props) {
  const methods = useForm<__Domain__CreateFields>({
    resolver: zodResolver(__Domain__CreateSchema) as Resolver<__Domain__CreateFields>,
    mode: "onSubmit",
    shouldUnregister: false,
    defaultValues: buildFormDefaultValues(domainConfig) as __Domain__CreateFields,
  });

  const router = useRouter();
  const { showToast } = useToast();
  const { trigger, isMutating } = useCreate__Domain__();
  useLoadingToast(isMutating, "登録中です…");

  const submit = async (data: __Domain__CreateFields) => {
    try {
      await trigger(data);
      showToast("登録しました", "success");
      router.push(redirectPath);
    } catch (error) {
      showToast(err(error, "登録に失敗しました"), "error");
    }
  };

  return (
    <__Domain__Form
      methods={methods}
      onSubmitAction={submit}
      isMutating={isMutating}
      submitLabel="登録"
      onCancel={() => router.push(redirectPath)}
    />
  );
}
